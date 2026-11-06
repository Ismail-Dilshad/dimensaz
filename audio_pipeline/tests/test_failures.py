import builtins
import importlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from audio_pipeline.cli import doctor, main
import json
import numpy as np

class FailureTests(unittest.TestCase):
    def test_doctor_returns_diagnostics_when_optional_modules_are_missing(self):
        original_import = builtins.__import__
        def missing(name, *args, **kwargs):
            if name == 'ctranslate2' or name.startswith('faster_whisper'):
                raise ImportError('unit test: optional module unavailable')
            return original_import(name, *args, **kwargs)
        with patch.object(importlib, 'import_module', side_effect=ImportError('unit fixture')), patch.object(builtins, '__import__', side_effect=missing):
            result = doctor()
        self.assertIsNone(result['stockWhisperSorani'])
        self.assertIsNone(result['cudaDeviceCount'])
        self.assertEqual(len(result['diagnostics']), 2)

    def test_other_languages_never_run_a_sorani_model(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            script = base / 'source.txt'; script.write_text('Hello world', encoding='utf-8')
            audio = base / 'fixture.wav'; audio.write_bytes(b'unit-hash-fixture-not-audio')
            output = base / 'alignment.json'
            argv = ['audio', 'analyze', '--script', str(script), '--audio', str(audio), '--output', str(output), '--language', 'en']
            with patch('sys.argv', argv), patch('audio_pipeline.cli.load_audio', return_value=(np.zeros(16000),16000)), patch('audio_pipeline.cli.run_ctc') as backend, patch('builtins.print'):
                main()
            backend.assert_not_called()
            result = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(result['backend']['language'], 'en')
            self.assertTrue(all(w['start'] is None and not w['reviewed'] for w in result['words']))
            self.assertIn('not en', result['errors'][0]['message'])
