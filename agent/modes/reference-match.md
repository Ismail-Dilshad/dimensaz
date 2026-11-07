# Mode: reference match

**Trigger:** the user gives a script plus a reference (image, video, link, named style
card or a `DESIGN.md`) and asks for that style.

## Goal

Recreate the reference's look and motion as closely as possible, **with the user's
own brand**: their logo, colors, fonts and voice from `config/brand.json`, and their
script. The result should feel like the same designer made it for the user's brand.

## Flow

1. **Collect.** Accept several references. For videos, sample frames
   (`pnpm references:clip`, `references:update`), and measure cut rhythm. For images,
   inspect each one individually.
2. **Study and write a style brief** (save it with the project):
   - **Rhythm:** average shot length, cut pattern, where accents land.
   - **Motion language:** easing curves, durations, stagger, overshoot, camera moves,
     transition types.
   - **Composition:** grid, margins, focal placement, scale contrast, negative space.
   - **Typography treatment:** size, weight, case, reveal style, highlight style.
     Map it to an allowed font (Kurdish: existing Kurdish fonts; others: open fonts).
   - **Color roles:** which role each reference color plays. Then map those roles
     onto the brand palette (the reference's accent becomes the brand accent).
   - **Materials and light:** flat, glass, clay, 3D; light direction and shadows.
   - **Background and texture:** grid, gradient, grain, noise.
3. **Confirm** the brief in a few lines and point out anything you will not copy
   (logos, characters, branded artwork, copyrighted footage).
4. **Build** with the reference production path (`skills/reelwright/SKILL.md`,
   `docs/guides/reference-motion.md`). Source separate hero and part assets; overlay
   real text; keep layers pinned.
5. **Compare side by side** with the reference at matching moments. Fix silhouette,
   placement, perspective and timing first, then detail. Improve physical mistakes in
   the reference (scale, contact, light, shadow) rather than copying them.
6. **Preview, approve, render, deliver** as in the script-to-motion mode.

## Rules

- Take rhythm, easing, composition and material language. Do not take the
  reference's logo, characters, mascots, branded artwork or exact scene order.
- Apply the user's brand, not the reference's palette, unless the user explicitly
  asks to keep the reference colors.
- If the brand profile is empty, ask for the logo and colors (or offer to derive
  roles from the reference and confirm).
