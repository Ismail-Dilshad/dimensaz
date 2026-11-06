"""Reelwright mascot states."""
STATES = {
    "idle": "Waiting for a prompt",
    "listening": "Reading your script or request",
    "thinking": "Reasoning about the edit",
    "planning": "Breaking the script into scenes and timing",
    "creating": "Generating images, icons and assets",
    "rendering": "Encoding and exporting the video",
    "done": "Export finished successfully",
    "excited": "Result is ready and looks great",
    "confused": "Request is unclear, asking a question",
    "error": "A step failed, retrying or reporting",
    "needs-approval": "Waiting for your approval or input",
    "sleeping": "Idle for a long time",
}


def face_path(state: str, size: int = 256, base: str = "assets/brand/expressions/png") -> str:
    if state not in STATES:
        raise ValueError(f"Unknown state {state!r}. Choose from: {', '.join(STATES)}")
    return f"{base}/mascot-{state}-{size}.png"
