# Pendulum Reveal

Use the production entry point with preset `pendulum-reveal`. The production
agent selects a brand, short alternating questions and replies, optional closing
CTA, footer and gradient colors. Use exact source phrases in ordered scenes.
**Approved house style (2026-11-04).** When the user says “same pendulum
motion”, “like the Ismail CS video” or asks to reuse this style, use the
[approved v8 export](../mp2/30fps/vertical/sponsorship/ismail-cs-pendulum-reveal_30fps_v8-original-audio.mp4)
and its [render manifest](../workspace/projects/2026-11-04_ismail-cs-pendulum-reveal_1203_v8/project.json)
as the visual and motion references. The earlier request in
`workspace/requests/ismail-pendulum/request.json` is the source of the motion
study; v8 is the approved treatment.

Both study clips are in **SaaS Motion Graphics**:
[original green-brand clip](motion-examples/SaaS%20Motion%20Graphics/green-brand-promotion-pendulum-badge-typography.mp4)
and [approved Ismail CS cut](motion-examples/SaaS%20Motion%20Graphics/ismail-cs-pendulum-reveal-approved.mp4).
Compare the start, middle and end of a swing: at the first extreme the question
is readable, midway the cord separates both phrases, and at the opposite extreme
the reply is fully visible. In the approved cut, also inspect the last outward
pass: the badge settles beyond the CTA and the edit ends before a return swing.

- **Keep the movement.** Use the green-brand reference geometry, 30 fps picture
  cadence, fixed camera, smooth single-pivot swing and thin cord. The cord is
  the edge of both headline masks. Change hidden copy at the outer turns. Keep
  the sweep and turnaround accent in phase with the badge.
- **Keep the letters natural.** Set `headlineFit: "proportional"`. Fit whole
  phrases with uniform scaling and intentional line breaks; keep Sorani shaping
  and the project's Kurdish font. Preserve the relative placement and scale of the full top logo,
  the centered badge symbol, the headline and the footer.
- **Finish once.** Reveal the last CTA on the outward swing, park at that
  turnaround, hold briefly to read, then cut in the quiet after the accent.
  Size the number of swings to the new copy. The approved example ends at 10 s;
  that duration is specific to its four questions and CTA.
- **Change the identity for each brief.** Supply the new palette, full wordmark,
  separate badge mark, exact questions, answers, footer and CTA. Center the badge
  mark by its visible bounds. Use brand variants with the same motion track;
  choose a different layout only when requested. Use appropriately authorized
  sound for the new video and preserve its source and timing.

For a smooth swing, fit one fixed pivot, radius, amplitude, phase and period to
the reviewed badge and cord measurements. Derive the cord, text mask and badge
from that same arc. Sample at 120 Hz for a 60 fps export. The stabilized Ismail
revision includes the fit and its measurements in
`workspace/requests/ismail-pendulum/stable-motion.py`. Set `showTopBrand: false`
for a clear top area. To place a symbol on the badge, import its transparent
image into the project and set `badgeImageId` to that media ID. Omission retains
the original text badge. Keep the symbol independent from the full wordmark.

For the “Motion that catches the eye” reference, select
`referenceLook: "light-editorial-pendulum"`. Use its own 2.5-second swing and
source hash, flat pale ground, small outlined brand above the headline, thicker
cord, charcoal tile, white centered badge mark and lower single-line footer.
Dark copy sits to the right of the moving cord and blue reply copy to its left.
The source uses purple for that reply; the user's version uses blue. The
measurements, stabilized arc, and original sound synthesis are in
`workspace/requests/ismail-pendulum/measure-light.py` and `light-sound.py`.

When the user wants **green-brand geometry with black, white, and blue answers**,
retain `referenceLook: "green-saas-pendulum"` and use
`palette: "monochrome-blue-answers"`. Use the green clip's timing, audio
reference, top lockup scale, two-line footer, thin cord, badge scale and wipe
direction. Import the full dark wordmark and the white badge symbol. Blue is
reserved for reply text. The light editorial layout has different geometry.

The validated request snapshot `pendulum` contains brand, footer, center, edge,
sampleFps, sourceHash and samples. Each sample is [badge center x, badge center y,
cord x at the top edge], normalized to the frame. The component places a single
continuous cord and badge and clips both whole shaped phrases along the cord.
Alternating scene boundaries mark left and right extrema where hidden text can
change. The final CTA stays readable through the last swing. Supply the full
shot's sampled motion, keep copy short enough to fit between the two outer
headline intersections, and retime deliberately when using a different recording.
This preset supports an unvoiced sound bed, fixed framing and one reading
direction per project. Inspect mid-wipe frames and both turnarounds.

For the blue Ismail CS treatment, recreate the original's 720×1280, 30 fps
picture cadence, central pool of blue light, dark questions, white replies,
compact top wordmark, fixed footer, thin cord and rounded badge. Sound alternates
a low passing sweep and a short endpoint accent. Use locally licensed effects
or original synthesis and verify cue placement and encoded audio.
