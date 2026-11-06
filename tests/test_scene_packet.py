"""Exercise the portable packet compiler without media generation or a renderer."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/legacy/custom-motion-shorts-v2/scripts"))
from scene_packet import compile_plan


def layer(name, kind, box):
    return dict(id=name, source=name, type=kind, box=box, anchor=[.5,.5],
                pivot=[.25,.75], rotation=0, scale=1, z=2)


class PacketTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        library = self.root / "assets/library/icons/one"
        library.mkdir(parents=True)
        data = b"existing cutout fixture"
        (library / "art").write_bytes(data)
        record = dict(id="one", name="lock", path="assets/library/icons/one/art",
                      hash=hashlib.sha256(data).hexdigest(), renderable=True,
                      evaluation={"reviewed":True}, provenance={"verified":True})
        (library / "metadata.json").write_text(json.dumps(record), encoding="utf8")
        (self.root / "anchor").write_bytes(b"reference fixture")
        scenes = []
        for i,copy in enumerate(["Unlock. ", "Open."]):
            layers = [layer("lock","asset",[100,500,200,300]), layer("key","asset",[320,500,120,100]),
                      layer("words","text",[50,100,900,200])]
            if i:
                for obj in layers[:2]:
                    obj["callback"] = "Show its state after unlocking."
            scenes.append(dict(title=copy, copy=copy, anchor="anchor", image="Key beside lock.", motion="Turn key.",
                               safe=[0,0,1080,1920], art=[30,400,1000,1000], text=[40,80,990,260],
                               contact="Separate slots", first="Key turned left", last="Key level", cut="Cut on lock",
                               layers=layers, moves=[dict(layer="key",start=24,end=54,prompt="Rotate 8 degrees.")]))
        self.plan = dict(title="Fixture", style="Fixture", rationale="Read silhouette", script="Unlock. Open.",
                         look="Cobalt grid", assetLook="Cobalt enamel in left light.", easing="Smoothstep",
                         timingNote="Silent", registry={"lock":{"assetId":"one"},
                         "key":dict(subject="skeleton key",size=[512,512],pose="Flat, teeth right",
                                    registration="Pivot at eyelet")}, scenes=scenes)

    def compile(self, reviewed=False):
        return compile_plan(self.plan,self.root,self.root,reviewed)

    def test_reserves_one_missing_asset_across_callbacks(self):
        packet, registry, queue = self.compile()
        self.assertEqual([q["asset"] for q in queue], ["key"])
        self.assertIn("512×512", queue[0]["prompt"])
        self.assertNotIn("grid", queue[0]["prompt"])
        self.assertEqual(registry["assets"]["key"]["instances"], ["S01/key","S02/key"])
        self.assertIn("[360, 720)", packet)
        self.assertEqual(queue,self.compile()[2])

    def test_rejects_flat_assets_and_existing_sources_in_queue(self):
        for subject in ["full scene", "asset sheet", "grid", "lock"]:
            with self.subTest(subject=subject):
                self.plan["registry"]["key"]["subject"]=subject
                with self.assertRaises(ValueError):
                    self.compile()

    def test_variable_cuts_and_motion_bounds(self):
        first, second = self.plan["scenes"]
        first["scoreFrames"], second["scoreFrames"] = 135, 427
        packet, _, _ = self.compile()
        self.assertIn("[135, 562)", packet)
        self.assertIn("**Frame 426**", packet)
        first["moves"][0].update(start=110, end=140)
        with self.assertRaisesRegex(ValueError, "motion"):
            self.compile()

    def test_rejects_out_of_range_competing_and_unreviewed_plans(self):
        with self.assertRaises(ValueError):
            self.compile(reviewed=True)
        moves=self.plan["scenes"][0]["moves"]
        moves[0]["end"]=361
        with self.assertRaises(ValueError):
            self.compile()
        moves[0]["end"]=54
        moves.append(dict(layer="lock",start=48,end=78,prompt="Move",phase="exit"))
        moves[0].update(dominant=False,phase="enter")
        with self.assertRaisesRegex(ValueError,"outgoing"):
            self.compile()


if __name__ == "__main__":
    unittest.main()
