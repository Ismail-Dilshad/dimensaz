import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import numpy as np
from audio_pipeline.hardware import ctc_plan, GIB, require_space
from audio_pipeline.backends import chunk_windows, convolution_geometry, run_auto
from audio_pipeline.core import make_analysis, correct_analysis, ctc_word_times, ctc_targets, digest
from audio_pipeline.setup import verified_folder, slug, acquire_model

MODEL='Akashpb13/Central_kurdish_xlsr'

class HardwareAlignmentTests(unittest.TestCase):
    def test_gpu_headroom_and_cpu_fallback(self):
        h={'memory':{'availableBytes':10*GIB},'torch':{'cudaAvailable':True,'freeBytes':3*GIB},'logicalCpus':12}
        self.assertEqual(ctc_plan(h)['device'],'cuda')
        self.assertEqual(ctc_plan(h)['precision'],'float32')
        h['torch']['freeBytes']=2*GIB
        self.assertEqual(ctc_plan(h)['device'],'cpu')
        with self.assertRaises(RuntimeError): ctc_plan(h,'cuda')
        h['memory']['availableBytes']=2*GIB
        with self.assertRaises(RuntimeError): ctc_plan(h)

    def test_chunks_cover_every_acoustic_frame_once(self):
        config=SimpleNamespace(conv_kernel=[10,3,3,3,3,2,2],conv_stride=[5,2,2,2,2,2,2])
        stride,rf=convolution_geometry(config)
        self.assertEqual((stride,rf),(320,400))
        for samples in [400,16000,677930,16000*121]:
            windows=list(chunk_windows(samples,stride,rf,16000*12,16000*2))
            indices=[i for w in windows for i in range(w['frameStart'],w['frameEnd'])]
            self.assertEqual(indices,list(range((samples-rf)//stride+1)))
            for w in windows:
                local_frames=(w['sampleEnd']-w['sampleStart']-rf)//stride+1
                self.assertLessEqual(w['keepEnd'],local_frames)
                self.assertEqual(w['sampleStart']%stride,0)

    def test_frame_intervals_are_not_stretched_to_audio_length(self):
        p=np.array([[.01,.99],[.99,.01],[.99,.01]],dtype='float32')
        ids,owners=ctc_targets('a',{'a':1})
        rows=ctc_word_times('a',np.log(p),ids,owners,0,20,frame_intervals=[[.2,.22],[.22,.24],[.24,.26]])
        self.assertEqual((rows[0]['start'],rows[0]['end']),(.2,.22))

    def test_bad_boundaries_become_unresolved_without_reordering_words(self):
        with tempfile.TemporaryDirectory() as temp:
            f=Path(temp)/'voice';f.write_bytes(b'test')
            timing=[{'start':.3,'end':.5,'confidence':.9},{'start':.4,'end':.7,'confidence':.8}]
            a=make_analysis('کڕیارەکەت، متمانە.',f,np.zeros(16000),16000,{'name':'fixture'},timing)
            self.assertEqual(a['words'][0]['originalWord'],'کڕیارەکەت،')
            self.assertEqual(a['words'][0]['normalizedWord'],'کڕیارەکەت')
            self.assertIsNone(a['words'][1]['start'])
            self.assertTrue(all(w['reviewRequired'] and not w['reviewed'] for w in a['words']))
            self.assertEqual(''.join(s['text'] for s in a['sentences']),a['script'])

    def test_fallback_preserves_failures_and_never_self_reviews(self):
        h={'torch':{'cudaAvailable':True,'freeBytes':3*GIB},'nvidia':[{'freeBytes':4*GIB}]}
        rows=[{'start':.1,'end':.3,'confidence':.9,'flags':[]}]
        with patch('audio_pipeline.backends.hardware_report',return_value=h), patch('audio_pipeline.backends.run_ctc',side_effect=[RuntimeError('CUDA OOM'),(rows,{'name':'ctc','textAgreement':.9})]) as ctc, patch('audio_pipeline.backends.converted_model',return_value='local'), patch('audio_pipeline.backends.run_whisper',side_effect=RuntimeError('missing cudnn')):
            actual,evidence=run_auto('a',np.zeros(16000),16000,'cache')
        self.assertEqual(actual,rows)
        self.assertEqual([call.kwargs['device'] for call in ctc.call_args_list],['cuda','cpu'])
        self.assertEqual(len(evidence['attempts']),2)
        self.assertNotIn('reviewed',evidence)

    def test_explicit_cpu_mode_never_probes_cuda_inference(self):
        h={'torch':{'cudaAvailable':True,'freeBytes':4*GIB},'nvidia':[{'freeBytes':4*GIB}]}
        rows=[{'start':.1,'end':.3,'confidence':.9,'flags':[]}]
        with patch('audio_pipeline.backends.hardware_report',return_value=h), patch('audio_pipeline.backends.run_ctc',return_value=(rows,{'name':'ctc','textAgreement':.9})) as ctc:
            run_auto('a',np.zeros(16000),16000,'cache',device='cpu',chunk_seconds=4)
        self.assertEqual(ctc.call_args.kwargs['device'],'cpu')
        self.assertEqual(ctc.call_args.kwargs['chunk_seconds'],4)

    def test_whisper_large_v3_nested_features_preserved(self):
        from audio_pipeline.setup import whisper_feature_config
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            (folder/'config.json').write_text(json.dumps({'num_mel_bins':128}))
            features={'feature_size':128,'sampling_rate':16000,'hop_length':160}
            (folder/'processor_config.json').write_text(json.dumps({'feature_extractor':features}))
            self.assertEqual(whisper_feature_config(folder),features)
            (folder/'config.json').write_text(json.dumps({'num_mel_bins':80}))
            with self.assertRaises(ValueError): whisper_feature_config(folder)

    def test_complete_failure_keeps_null_path(self):
        with patch('audio_pipeline.backends.hardware_report',return_value={'torch':{},'nvidia':[]}), patch('audio_pipeline.backends.run_ctc',side_effect=RuntimeError('missing model')), patch('audio_pipeline.backends.converted_model',side_effect=FileNotFoundError('missing alternative')):
            rows,evidence=run_auto('a',np.zeros(16000),16000,'cache')
        self.assertIsNone(rows)
        self.assertEqual(evidence['name'],'manual-assisted')
        self.assertEqual(len(evidence['attempts']),2)

    def test_integrity_failure_preserves_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);folder=root/'snapshot';folder.mkdir();f=folder/'model.safetensors';f.write_bytes(b'original')
            receipt={'model':MODEL,'revision':'a'*40,'path':str(folder),'files':[{'name':f.name,'size':8,'sha256':digest(f)}]}
            (root/'installed').mkdir();(root/'installed'/(slug(MODEL)+'.json')).write_text(json.dumps(receipt))
            self.assertEqual(verified_folder(MODEL,root)[0],folder)
            f.write_bytes(b'changed!')
            with self.assertRaises(ValueError): verified_folder(MODEL,root)
            self.assertEqual(f.read_bytes(),b'changed!')

    def test_download_does_not_ignore_corrupt_cache(self):
        with patch('audio_pipeline.setup.verified_folder',side_effect=ValueError('corrupt')),patch('audio_pipeline.setup.network_check') as network:
            with self.assertRaises(ValueError): acquire_model(MODEL,'cache')
            network.assert_not_called()

    def test_space_reserve_is_enforced(self):
        with patch('audio_pipeline.hardware.disk_info',return_value={'path':'fixture','freeBytes':6*GIB}):
            with self.assertRaises(RuntimeError): require_space('fixture',2*GIB)

if __name__=='__main__':unittest.main()

class EvaluationTests(unittest.TestCase):
    def test_only_explicit_reviewed_samples_can_measure_accuracy(self):
        from audio_pipeline.evaluation import evaluate_samples
        analysis={'audioSha256':'a'*64,'duration':2,'words':[{'text':'سڵاو','start':.2,'end':.6}]}
        reference={'audioSha256':'a'*64,'reviewer':'fixture reviewer','reviewed':True,'words':[{'index':0,'text':'سڵاو','start':.21,'end':.58}]}
        result=evaluate_samples(analysis,reference)
        self.assertAlmostEqual(result['meanBoundaryErrorMs'],15)
        self.assertEqual(result['matchedSamples'],1)
        reference['reviewed']=False
        with self.assertRaises(ValueError):evaluate_samples(analysis,reference)

class TokenizerCompatibilityTests(unittest.TestCase):
    def test_new_list_metadata_preserves_ids_and_original_file(self):
        from audio_pipeline.setup import load_whisper_tokenizer
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            source=json.dumps({'extra_special_tokens':['<|fa|>','<|transcribe|>']})
            (folder/'tokenizer_config.json').write_text(source)
            vocab={'a':0,'<|fa|>':1,'<|transcribe|>':2}
            with patch('transformers.AutoTokenizer.from_pretrained') as load, patch('tokenizers.Tokenizer.from_file') as raw:
                load.return_value.get_vocab.return_value=vocab
                raw.return_value.get_vocab.return_value=vocab
                load_whisper_tokenizer(folder)
                self.assertEqual(load.call_args.kwargs['extra_special_tokens'],{})
                self.assertEqual(load.call_args.kwargs['additional_special_tokens'],['<|fa|>','<|transcribe|>'])
                load.return_value.get_vocab.return_value={'a':9}
                with self.assertRaises(ValueError): load_whisper_tokenizer(folder)
            self.assertEqual((folder/'tokenizer_config.json').read_text(),source)
