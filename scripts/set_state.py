#!/usr/bin/env python3
"""Write the agent's current state to .tempoloom/state.json.

Usage:  python set_state.py rendering "scene 3 of 7"
"""
import json, os, sys, time
from tempoloom_states import STATES

state = sys.argv[1] if len(sys.argv) > 1 else "idle"
detail = sys.argv[2] if len(sys.argv) > 2 else ""
if state not in STATES:
    sys.exit(f"Unknown state {state!r}. Choose from: {', '.join(STATES)}")
os.makedirs(".tempoloom", exist_ok=True)
tmp = ".tempoloom/state.json.tmp"
with open(tmp, "w") as f:
    json.dump({"state": state, "detail": detail, "updated": int(time.time())}, f)
os.replace(tmp, ".tempoloom/state.json")
print(f"state -> {state} {detail}".strip())
