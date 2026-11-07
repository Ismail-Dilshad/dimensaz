import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from media_tools.common import ROOT, merge_ranges, write_new
from media_tools.silence import ranges_from_chunks
from media_tools.scenes import summarize
from media_tools.beats import bars
from media_tools.faces import focus_from_track
from media_tools.cutout import output_for
from media_tools.quality import flags
from media_tools.separate import output_folder


def has(module):
    return importlib.util.find_spec(module) is not None


def ffmpeg():
    exe = 'ffmpeg.exe' if os.name == 'nt' else 'ffmpeg'
    local = ROOT / 'node_modules/ffmpeg-static' / exe
    return os.environ.get('FFMPEG_PATH') or (str(local) if local.is_file() else shutil.which('ffmpeg'))


def make(args):
    subprocess.run([ffmpeg(), '-v', 'error', '-y', *args], check=True)


class LogicTests(unittest.TestCase):
    def test_chunks_become_cut_and_keep_ranges(self):
        cuts, keep = ranges_from_chunks([[0, 220, 1.0], [220, 380, 99999.0], [380, 601, 1.0]], 100)
        self.assertEqual(cuts, [[2.2, 3.8]])
        self.assertEqual(keep, [[0.0, 2.2], [3.8, 6.01]])

    def test_short_silences_are_kept(self):
        cuts, keep = ranges_from_chunks([[0, 100, 1.0], [100, 110, 99999.0], [110, 200, 1.0]], 100, min_cut=0.3)
        self.assertEqual(cuts, [])
        self.assertEqual(keep, [[0.0, 2.0]])

    def test_merge_ranges(self):
        self.assertEqual(merge_ranges([[3, 4], [0, 1], [1.05, 2]], gap=0.1), [[0, 2], [3, 4]])

    def test_rhythm_summary(self):
        r = summarize([(0, 2), (2, 3), (3, 6)], 6)
        self.assertEqual((r['shotCount'], r['cutCount'], r['averageShotSeconds'], r['cutsPerMinute']), (3, 2, 2.0, 20.0))

    def test_bar_starts_every_fourth_beat(self):
        self.assertEqual(bars([0, 1, 2, 3, 4, 5, 6, 7, 8]), [0, 4, 8])

    def test_focus_uses_median_and_flags_movement(self):
        still = focus_from_track([{'face': True, 'x': .4, 'y': .3}, {'face': True, 'x': .42, 'y': .32}, {'face': False}])
        self.assertEqual((still['focusX'], still['static']), (0.41, True))
        moving = focus_from_track([{'face': True, 'x': .1, 'y': .3}, {'face': True, 'x': .9, 'y': .3}])
        self.assertFalse(moving['static'])
        self.assertIsNone(focus_from_track([{'face': False}]))

    def test_outputs_never_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'a.png'; source.write_bytes(b'x')
            first = output_for(source, temp); first.write_bytes(b'y')
            self.assertNotEqual(output_for(source, temp), first)
            write_new(Path(temp) / 'r.json', {'a': 1})
            with self.assertRaises(FileExistsError):
                write_new(Path(temp) / 'r.json', {'a': 2})

    def test_cutout_model_found_in_rembg_layout(self):
        from media_tools.cutout import model_file
        with tempfile.TemporaryDirectory() as temp:
            os.environ['VIDEO_MEDIA_MODEL_DIR'] = temp
            try:
                target = Path(temp) / 'rembg/models/u2netp/u2netp.onnx'
                self.assertEqual(model_file('u2netp'), target)
                legacy = Path(temp) / 'rembg/u2netp.onnx'; legacy.write_bytes(b'x')
                self.assertEqual(model_file('u2netp'), legacy)
                target.parent.mkdir(parents=True); target.write_bytes(b'x')
                self.assertEqual(model_file('u2netp'), target)
            finally:
                del os.environ['VIDEO_MEDIA_MODEL_DIR']

    def test_quality_flags(self):
        good = {'sharpness': 300, 'brightness': .5, 'clippedHighlights': 0, 'crushedShadows': 0, 'noise': 1}
        self.assertEqual(flags(good), [])
        self.assertEqual(flags({**good, 'brightness': .01}), ['black'])
        self.assertEqual(flags({**good, 'sharpness': 10, 'noise': 9}), ['blurry', 'noisy'])

    def test_stems_folder_never_reused(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'voice.wav'
            first = output_folder(source, temp)
            self.assertEqual(first.name, 'voice-stems')
            self.assertEqual(output_folder(source, temp).name, 'voice-stems-2')

    @unittest.skipUnless(has('numpy'), 'numpy not installed')
    def test_corrections_cancel_jitter_and_keep_pans(self):
        import numpy as np
        from media_tools.stabilize import corrections
        steps = [(2.0 + (3 if i % 2 else -3), 0.0, 0.0, 1.0) for i in range(60)]  # steady pan plus jitter
        fixed = corrections(steps, 30, 0.5)
        path = np.vstack([np.zeros((1, 3)), np.cumsum(np.asarray(steps)[:, :3], axis=0)])
        result = (path + fixed)[:, 0]
        self.assertLess(np.abs(np.diff(np.diff(result[10:-10]))).max(), 0.5)
        self.assertGreater(result[-10] - result[10], 60)


@unittest.skipUnless(ffmpeg(), 'needs ffmpeg')
class ToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT / 'workspace/cache/temp' if (ROOT / 'workspace/cache/temp').is_dir() else None)
        cls.dir = Path(cls.temp.name)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    @unittest.skipUnless(has('auto_editor'), 'auto-editor not installed')
    def test_silence_finds_the_gap(self):
        from media_tools.silence import detect
        wav = self.dir / 'gap.wav'
        make(['-f', 'lavfi', '-i', 'sine=f=440:d=2', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
              '-filter_complex', '[1]atrim=0:2[s];[0][s][0]concat=n=3:v=0:a=1', '-ar', '44100', '-ac', '1', str(wav)])
        result = detect(wav)
        self.assertEqual(len(result['cuts']), 1)
        cut = result['cuts'][0]
        self.assertTrue(2.0 <= cut['start'] <= 2.4 and 3.6 <= cut['end'] <= 4.0, cut)
        self.assertEqual(result['edlOperation']['op'], 'cut')

    @unittest.skipUnless(has('scenedetect'), 'PySceneDetect not installed')
    def test_scenes_find_hard_cuts(self):
        from media_tools.scenes import detect
        video = self.dir / 'cuts.mp4'
        make(['-f', 'lavfi', '-i', 'color=red:s=320x240:d=2:r=25', '-f', 'lavfi', '-i', 'color=blue:s=320x240:d=1.5:r=25',
              '-f', 'lavfi', '-i', 'testsrc=size=320x240:duration=2:rate=25',
              '-filter_complex', '[0][1][2]concat=n=3:v=1:a=0,format=yuv420p', str(video)])
        result = detect(video)
        self.assertEqual(result['rhythm']['shotCount'], 3)
        self.assertAlmostEqual(result['cutTimes'][0], 2.0, delta=0.1)
        self.assertAlmostEqual(result['cutTimes'][1], 3.5, delta=0.1)

    @unittest.skipUnless(has('librosa'), 'librosa not installed')
    def test_beats_follow_a_click_track(self):
        from media_tools.beats import detect
        click, track = self.dir / 'click.wav', self.dir / 'clicks.wav'
        make(['-f', 'lavfi', '-i', 'sine=f=1000:d=0.05', '-af', 'apad=pad_dur=0.45', str(click)])
        make(['-stream_loop', '15', '-i', str(click), '-c', 'copy', str(track)])
        result = detect(track)
        self.assertAlmostEqual(result['tempoBpm'], 120, delta=6)
        gaps = [b - a for a, b in zip(result['beats'], result['beats'][1:])]
        self.assertTrue(all(abs(g - 0.5) < 0.05 for g in gaps), gaps)

    @unittest.skipUnless(has('cv2'), 'OpenCV not installed')
    def test_stabilize_removes_shake(self):
        from media_tools.stabilize import stabilize
        from media_tools.quality import check
        still, shaky = self.dir / 'still.png', self.dir / 'shaky.mp4'
        make(['-f', 'lavfi', '-i', 'testsrc2=size=960x540:rate=1:duration=1', '-frames:v', '1', str(still)])
        make(['-loop', '1', '-framerate', '30', '-t', '3', '-i', str(still), '-vf',
              'crop=900:506:30+8*sin(n*1.7)+5*cos(n*3.1)+n*0.5:17+6*cos(n*2.3)+4*sin(n*4.1)', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(shaky)])
        os.environ.setdefault('FFMPEG_PATH', ffmpeg())
        result = stabilize(shaky)
        self.assertGreater(result['shakeBefore'], 2)
        self.assertLess(result['shakeAfter'], result['shakeBefore'] / 3)
        self.assertTrue(Path(result['output']).is_file())
        quality = check(result['output'])
        self.assertEqual(quality['summary']['flagCounts'].get('black'), None)

    @unittest.skipUnless(has('demucs'), 'Demucs not installed')
    def test_separation_writes_stems(self):
        from media_tools.separate import separate
        mix = self.dir / 'mix.wav'
        make(['-f', 'lavfi', '-i', 'sine=f=220:d=2', '-ac', '2', '-ar', '44100', str(mix)])
        result = separate(mix, model='demucs_unittest', out_dir=self.dir)
        self.assertEqual(sorted(result['stems']), ['music', 'vocals'])
        self.assertTrue(all(Path(p).is_file() for p in result['stems'].values()))

    @unittest.skipUnless(has('cv2'), 'OpenCV not installed')
    def test_pacing_fails_static_text_and_passes_motion(self):
        from media_tools.pacing import check
        still, moving = self.dir / 'still-text.mp4', self.dir / 'moving.mp4'
        make(['-f', 'lavfi', '-i', 'color=c=0xF7F8FC:s=540x960:d=4:r=30', '-vf',
              'drawbox=x=170:y=440:w=200:h=60:color=0x0F172A:t=fill,format=yuv420p', str(still)])
        make(['-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=30:duration=4', '-pix_fmt', 'yuv420p', str(moving)])
        bad = check(still)
        self.assertFalse(bad['pass'])
        self.assertTrue(bad['staticSpans'] and bad['plainSpans'])
        good = check(moving)
        self.assertTrue(good['pass'], good['problems'])
        self.assertGreater(good['movingShare'], 0.8)


if __name__ == '__main__':
    unittest.main()
