# Animation controls

The registry src/animations/animation-registry.ts lists all working presets.
motion(name,t,{duration,delay,easing,direction,intensity}) returns deterministic
opacity, transform, blur, clip and emphasis values. Each preset is covered by
a deterministic numeric test. Per-scene examples can be made by setting
scene.animation in project.json. Global config.animation overrides auto-planning.

Text: center-word-by-word, sentence-build, sentence-by-sentence, typewriter,
mask-reveal, blur-reveal, staggered-text, smooth-replacement.
Bounce: bounce-up, bounce-slide-up, bouncy-slide-glow, spring-pop, elastic-scale,
squash-stretch.
Emphasis: keyword-highlight, marker-sweep, underline-draw, glow-pulse,
keyword-zoom, color-transition, strikethrough-reveal.
Composition: text-stack, split-screen, comparison-layout, saas-feature-card,
statistics-counter, cta-reveal, floating-cards.
Object: floating-objects, parallax, soft-rotation, spring-entrance, shadow-animation.
Transitions: fade, slide, zoom, blur, mask-transition.

Themes: minimal-kinetic, saas-motion, clay-motion, bold-viral, editorial,
highlight-explainer. Set config.visuals=true to use procedural illustrations.
Use config.reducedMotion=true to replace motion with fades and freeze drift.

The initial planner is rule-based and conservative. Manual role, layout,
animation, asset, duration and highlights edits are supported. Number counters
need explicit scene.number metadata; never infer or invent an unverified number.
Transitions are exit/entrance effects without timeline overlaps. Comparisons use
two CSS columns; manually arrange source scene text if the automatic split is poor.
