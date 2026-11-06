import copy
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
import soundfile as sf
from audio_pipeline.core import tokens, ctc_targets, ctc_viterbi, ctc_word_times, detect_pauses, make_analysis, correct_analysis, group_sentences

class AcousticTests(unittest.TestCase):
    def test_known_signal_pause_is_measured(self):
        rate = 16000
        tone = (.2*np.sin(2*np.pi*220*np.arange(rate)/rate)).astype("float32")
        signal = np.r_[tone, np.zeros(6400, dtype="float32"), tone]
        pauses, waveform = detect_pauses(signal, rate)
        self.assertEqual(len(pauses), 1)
        self.assertAlmostEqual(pauses[0]["start"], 1, places=2)
        self.assertAlmostEqual(pauses[0]["end"], 1.4, places=2)
        self.assertTrue(waveform)
    def test_repeated_ctc_labels_require_a_blank(self):
        lp = np.log(np.array([[.01,.98,.01],[.98,.01,.01],[.01,.98,.01],[.01,.01,.98]], dtype="float32"))
        path, states = ctc_viterbi(lp, [1,1,2], 0)
        self.assertTrue(np.any(path == 1))
        self.assertTrue(np.any(path == 3))
        self.assertTrue(np.any(path == 5))
        with self.assertRaises(ValueError):
            ctc_viterbi(lp[:1], [1,1,2], 0)
    def test_acoustic_word_spans_come_from_frames(self):
        vocab={"a":1,"b":2,"|":3}
        ids, owners = ctc_targets("aa b", vocab)
        sequence=[1,0,1,3,2,2,0,0]
        p=np.full((8,4), .005, dtype="float32")
        for i, label in enumerate(sequence): p[i,label]=.985
        rows=ctc_word_times("aa b",np.log(p),ids,owners,0,.8)
        self.assertAlmostEqual(rows[0]["start"],0)
        self.assertAlmostEqual(rows[0]["end"],.3)
        self.assertAlmostEqual(rows[1]["start"],.4)
        self.assertAlmostEqual(rows[1]["end"],.6)
    def test_missing_vocabulary_does_not_drop_script_glyphs(self):
        with self.assertRaises(ValueError):
            ctc_targets("\u0633\u06b5\u0627\u0648", {"a":1,"|":2})
    def test_utf16_offsets_keep_original_script(self):
        script="\U00010400 \u0633\u06b5\u0627\u0648!"
        tt=tokens(script)
        self.assertEqual(tt[0]["to"],2)
        self.assertEqual(tt[1]["from"],3)
        self.assertEqual(tt[1]["text"],"\u0633\u06b5\u0627\u0648!")
    def test_unresolved_words_stay_null_and_manual_edits_are_explicit(self):
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/"test-signal.wav"
            samples=np.zeros(16000,dtype="float32")
            sf.write(file,samples,16000)
            script=" \u0633\u06b5\u0627\u0648!\r\n\r\n\u0645\u062a\u0645\u0627\u0646\u06d5."
            a=make_analysis(script,file,samples,16000,{"name":"unit-signal-test"})
            self.assertTrue(all(w["start"] is None and not w["reviewed"] for w in a["words"]))
            self.assertEqual("".join(s["text"] for s in a["sentences"]),script)
            b=correct_analysis(a,[{"index":0,"start":.1,"end":.3,"reviewed":True},{"index":1,"start":.5,"end":.8,"reviewed":True}],"test reviewer")
            self.assertTrue(b["reviewed"])
            self.assertEqual(a["script"],b["script"])
            self.assertEqual(a["audioSha256"],b["audioSha256"])
            self.assertIsNone(a["words"][0]["start"])
            with self.assertRaises(ValueError):
                correct_analysis(a,[{"index":0,"start":.5,"end":.8},{"index":1,"start":.6,"end":.9}],"test reviewer")

if __name__=="__main__":
    unittest.main()
