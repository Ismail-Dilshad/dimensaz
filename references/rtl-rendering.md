# RTL rendering

Read sorani-typography.md. window.render(t) evaluates absolute timestamps.
No real-time CSS animations or requestAnimationFrame loops drive output.
Video seeks use completion events; a timeout only detects failed decoding.
Fonts and image decoding finish before capture. Out-of-order renders must match.
