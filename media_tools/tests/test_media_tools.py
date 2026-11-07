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


if __name__ == '__main__':
    unittest.main()
