# 3D object library

Reusable 3D-looking objects (images, not rotatable models) in one consistent studio
look: clean white, silver and cobalt-blue materials with soft top-left light. Each
folder holds the original PNG, a small preview and `metadata.json`. Never edit pinned
bytes; create a variant with `parentAssetId` instead. Search with
`pnpm assets:library search --query WORDS`.

## Named objects

- [Black Smartphone with Blue Screen](black-smartphone-with-blue-screen/black-smartphone-with-blue-screen.png)
- [Blue and White Bullseye Target](blue-and-white-bullseye-target/blue-and-white-bullseye-target.png)
- [Blue and White Megaphone Clean Cutout](blue-and-white-megaphone-clean-cutout/blue-and-white-megaphone-clean-cutout.png)
- [Blue and White Shop with Striped Awning](blue-and-white-shop-with-striped-awning/blue-and-white-shop-with-striped-awning.png)
- [Blue Dart with Metal Tip](blue-dart-with-metal-tip/blue-dart-with-metal-tip.png)
- [Blue Diamond with Price Tag](blue-diamond-with-price-tag/blue-diamond-with-price-tag.png)
- [Blue Horseshoe Magnet](blue-horseshoe-magnet/blue-horseshoe-magnet.png)
- [Blue Identification Badge](blue-identification-badge/blue-identification-badge.png)
- [Blue Jigsaw Puzzle Piece](blue-jigsaw-puzzle-piece/blue-jigsaw-puzzle-piece.png)
- [Blue Location Map Pin](blue-location-map-pin/blue-location-map-pin.png)
- [Blue Movie Clapperboard with Play Button](blue-movie-clapperboard-with-play-button/blue-movie-clapperboard-with-play-button.png)
- [Blue Rectangular Speech Bubble](blue-rectangular-speech-bubble/blue-rectangular-speech-bubble.png)
- [Glass Hourglass with Blue Sand](glass-hourglass-with-blue-sand/glass-hourglass-with-blue-sand.png)
- [Miniature Shop Interior with Display Shelves](miniature-shop-interior-with-display-shelves/miniature-shop-interior-with-display-shelves.png)
- [Neutral Cash Register Body](neutral-cash-register-body/neutral-cash-register-body.png)
- [Neutral Cash Register Drawer](neutral-cash-register-drawer/neutral-cash-register-drawer.png)
- [Neutral Customer Location Pin](neutral-customer-location-pin/accent-mask.png)
- [Neutral Embossed Coin](neutral-embossed-coin/neutral-embossed-coin.png)
- [Neutral Gift Box With Bow](neutral-gift-box-with-bow/neutral-gift-box-with-bow.png)
- [Neutral Miniature Storefront](neutral-miniature-storefront/accent-mask.png)
- [Neutral Shopping Bag with Handles and Tag](neutral-shopping-bag-with-handles-and-tag/neutral-shopping-bag-with-handles-and-tag.png)
- [Neutral Store Location Pin](neutral-store-location-pin/neutral-store-location-pin.png)
- [Round Speech Bubble with Blue Border](round-speech-bubble-with-blue-border/round-speech-bubble-with-blue-border.png)
- [Shopping Cart with Blue Gift Box](shopping-cart-with-blue-gift-box/shopping-cart-with-blue-gift-box.png)
- [Silver Lightbulb Socket](silver-lightbulb-socket/silver-lightbulb-socket.png)
- [White and Blue Paper Airplane](white-and-blue-paper-airplane/white-and-blue-paper-airplane.png)
- [White Briefcase Body without Handle](white-briefcase-body-without-handle/white-briefcase-body-without-handle.png)
- [White Ceramic Play Button](white-ceramic-play-button/white-ceramic-play-button.png)
- [White Ceramic Screen Frame](white-ceramic-screen-frame/white-ceramic-screen-frame.png)
- [White Jigsaw Puzzle Piece Center](white-jigsaw-puzzle-piece-center/white-jigsaw-puzzle-piece-center.png)
- [White Jigsaw Puzzle Piece Upper Left](white-jigsaw-puzzle-piece-upper-left/white-jigsaw-puzzle-piece-upper-left.png)
- [White Jigsaw Puzzle Piece Upper Middle](white-jigsaw-puzzle-piece-upper-middle/white-jigsaw-puzzle-piece-upper-middle.png)
- [White Person Hand on Head Pose Cutout](white-person-hand-on-head-pose-cutout/white-person-hand-on-head-pose-cutout.png)
- [White Person Hand on Head Pose Original](white-person-hand-on-head-pose-original/white-person-hand-on-head-pose-original.png)
- [White Person Map Pin Cutout](white-person-map-pin-cutout/white-person-map-pin-cutout.png)
- [White Person Map Pin Original](white-person-map-pin-original/white-person-map-pin-original.png)
- [White Person Open Hand Pose Cutout](white-person-open-hand-pose-cutout/white-person-open-hand-pose-cutout.png)
- [White Person Open Hand Pose Original](white-person-open-hand-pose-original/white-person-open-hand-pose-original.png)
- [White Person Raised Hand Pose Cutout](white-person-raised-hand-pose-cutout/white-person-raised-hand-pose-cutout.png)
- [White Person Raised Hand Pose Original](white-person-raised-hand-pose-original/white-person-raised-hand-pose-original.png)
- [White Smartphone Lying Flat](white-smartphone-lying-flat/white-smartphone-lying-flat.png)
- [White Smartphone with Pale Blue Screen](white-smartphone-with-pale-blue-screen/white-smartphone-with-pale-blue-screen.png)

## Other folders

- `asset-<hash>/` (23 registered studio objects): neutral masters and cobalt variants
  (rocket, tag, hourglass, envelope, pin, card, terminal, badge, phone, pad, shoe).
- `studio-sponsorship-20261103/`: per-object recolor recipes (`recipe.json` and the
  accent mask). Recipes reference their source by `sourceHash`, the registered asset id.
- `reference-*-20261102/`: neutral and blue parts generated for reference recreations,
  with their prompts and generation notes.

2D illustrations, flat shapes, near-duplicate variants, test recolors and the retired
origami set were removed in 3.2.0 (see CHANGELOG); git history keeps them.
