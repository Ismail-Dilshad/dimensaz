"""Inventory visually inspected references without modifying their bytes.

Run only after inspecting changed references. Hashing is integrity evidence, not
automatic visual review. The observations below came from the 54-image review.
"""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
OBSERVATIONS = {
 'style-1': [
  'Glass bulb with blue question filament; large upper navy headline and raised rounded blue block; reflective floor, upper-left highlights.',
  'White hand enters from lower right; blue speech bubble above palm; top headline, rectangular emphasis block, thin circular outline and verification badge.',
  'Diagonal blue magnet dominates upper-right middle; small person-pins stream from lower left; dashed curved path; top inline blue keyword.',
  'Matte faceless bust at left; blue question mark at temple; right-side navy/blue shadowed lettering and faint duplicate words; long blue floor shadow.',
  'Megaphone at diagonal with concentric pale-blue sound rings; growth card and arrow; bottom two-line headline with rounded blue emphasis.',
  'Striped miniature shop at right; three-line headline stack at left; briefcase lower left, tiny play/view card upper right; generous empty top area.',
  'Wire shopping cart behind raised striped barrier; top emphasis block; turn-back arrow and stop symbol; lower-right cast shadows.',
  'Cart with ribboned parcel between faded small shop and bright larger shop; curved directional path; lower headline and faint duplicate text.',
  'White tilted phone supports outlined blue chat bubble and paper plane; top navy headline and broad blue block; thin flight curve and check badge.',
  'White blue-screen phone tilted left; crowd emerges onto floor; ring behind phone, shopping-bag accent; top headline with inline emphasis.'
 ],
 'style-2': [
  'Cash register at right overlaps left headline; drawer exposes one blue coin; separate shopping bag lower left; large top breathing room.',
  'Floating angled control panel with three sliders and one rotary knob; connector to check icon; bottom single-line headline with blue keyword block.',
  'Tilted circular target below large upper headline; dart reaches luminous person-pin bullseye; small ribboned parcel and pale curved trail.',
  'Floating blue play screen above small white audience; dashed/solid circular outlines; heart bubble; bottom headline uses blue letters without block.',
  'Large glossy blue-iris eyeball with play pupil; thin circular outline and small growth card; bottom inline blue emphasis.',
  'Transparent jar packed with white eyeballs and a single glowing bottom coin; small magnifier and downward arrow; upper headline plus partially occluded duplicate text.',
  'White jigsaw recedes diagonally; blue piece floats over matching gap with particle specks; curved down arrow; left/lower headline and blue block.',
  'Large blue-handled stamp overlaps oversized upper text; identical blank-square cards recede diagonally; small circled X; blue ink splash.',
  'White tilted phone with blue growth chat tile, leaf relief and arrow; bottom Sorani line and GROW block; lower-right organic corner.'
 ],
 'style-3': [
  'Glossy black cube with red shop, wrench and play reliefs; red ring and corner sparkle; lower-left three-line headline with middle red block.',
  'Black glass-faced compass and red needle point upper right; fine scale markings, red ring, dotted direction arrow; bottom white headline and red block.',
  'Large black screen above a few white seated people amid many empty dark chairs; red circular floor boundary; upper headline partly obscured by screen.',
  'Black textured mountain with red flag and tiny white climber; dotted summit route and red ring; upper inline red headline block.',
  'Red key enters black lock plate; curved white connector and check badge; upper white headline and red emphasis; red contact glow.',
  'Tilted black phone behind red speech bubble and white paper plane; looped red path, check badge, red floor glow; large top two-line call to action.',
  'Heavy weathered steel vault door opens onto red light; volumetric-looking beam and white open briefcase; upper giant headline and small red label.',
  'Detailed black leather wallet floats in foreground; faded cash pile crossed out in red, two red coins and upward arrow; lower inline emphasis.'
 ],
 'style-4': [
  'Cream stairs ascend right; small figure steps onto glowing orange tread, flag at summit; headline at left crosses behind stairs; dotted cream backdrop.',
  'Expressive tired cream shopkeeper behind weathered wooden counter and old register; clock upper left and crossed-out customer upper right; lower headline; long warm shadow.',
  'Oversized orange lightning push-button on cream base; pointing hand enters lower right; top headline with orange band; tactile fine surface grain.',
  'Large orange location pin above tiny cream shop; concentric floor signals and small person-pins; top headline; inset rounded poster border.',
  'Cream phone at diagonal with smooth orange chat bubble and separate cream paper plane; orange arc and check badge; upper headline and orange band.'
 ],
 'style-5': [
  'Level dark-green metallic balance scale: pearl eyeball versus lime shopping bag; large lime ring; top ivory headline and smaller bottom-right lime label.',
  'Oversized glossy lime question mark with separated dot dwarfs a small white person; bottom headline and dark-on-lime emphasis; deep-green floor pool.',
  'Curved dark-green stadium packed with tiny white figures faces one luminous lime shop; wide scale contrast; upper headline and lime keyword.',
  'Large pearl hand reaches down from right toward small figure on lime-edged ledge; contact glow and curved help arrow; upper text; thin rounded frame.',
  'Fabric tailor mannequin at right with lime measuring tape wrapped around torso; floating scissors and pincushion; left headline partly behind torso.',
  'Vintage green-and-ivory microphone encircled by bright lime broken ring; small question bubble; upper headline and lime question block.',
  'Opposing green signboards at forked path: eye points left, shopping bag right; labels near each branch; lime ring and tiny sparkle.',
  'Empty pearl metal cart with lime price tag; departing blurred crowd behind; bottom inline lime emphasis and upper-right question symbol.',
  'Dark-green phone with luminous lime bubble and pearl envelope with lime seal; upper headline and wide dark-on-lime band; green ground glow.',
  'Pearl sphere versus faceted lime pyramid, divided by vertical line; separate shadows, bottom not-equal badge; upper headline and rounded lime block.'
 ],
 'style-6': [
  'Black doorway at right emits red light across floor; queue of white people enters; left headline and red keyword; thin inset rounded frame.',
  'Glossy black eye shell surrounds red iris; suspended red zero and small empty basket; top headline; red ring and rim highlights.',
  'Large red-rim magnifier crosses black ribboned gift; glass highlights and bright gift sparkle; upper red tab and oversized white headline.',
  'Black megaphone with red inner bell and forward sound rings; lower headline and glowing red emphasis; small warning badge upper right.',
  'Mechanical black odometer with red digit wheels; falling red coins above and scattered coins below; top headline and red block; ring behind.',
  'Steeply rising red bars contrast with one low gray bar circled white; tallest bar overlaps upper headline band; black reflective base and upward arrow.',
  'Red octagonal raised-hand stop sign; red coin paused above black slot; top red tab and oversized white headline; small pause icon.',
  'Black phone, red bubble, white plane and check badge; top call to action; looped red trail; rounded inset panel.',
  'Black and white hands shake across frame; red burst at contact and concentric rings; enormous upper headline and compact red label.'
 ],
 'style-7': [
  'Translucent violet coin enters pearl box; glass violet check on lid and white X card; top small violet pill and indigo headline; orbital line and violet shadow.',
  'Tall violet liquid-filled glass cylinder with bubbles and white base; cylinder occludes violet headline pill while indigo text crosses foreground; 100 UI card.',
  'Pearl hand cups glowing faceted violet gem; thin tilted orbit and sparkles; large indigo upper headline, small violet label and checklist card; soft pink/violet haze.'
 ]
}
DETAILS = {
 'style-1': ('cool white, navy and vivid blue', 'square grid; fine diagonals; occasional blue organic corners', 'matte white, cobalt plastic, selective glass', 'upper-left studio source; cool long shadows', 'navy/blue whole-word headlines; square or rounded blue emphasis; occasional ghost lettering', 'discovery, attraction, recognition, contact', 10, 'written six-second directions; not observed motion'),
 'style-2': ('cool white, navy and vivid blue', 'square grid, diagonals and sparse corner shapes', 'white tactile mechanisms, blue gloss, clear glass', 'upper-left studio source and blue reflections', 'oversized navy headlines; blue blocks; subject-dependent occlusion', 'attention versus results, targeting and customization', 9, 'written six-second directions; not observed motion'),
 'style-3': ('near-black, white and vivid red', 'dark square grid, faint red diagonals, charcoal corners', 'glossy black, textured steel/leather/rock and red relief', 'hard highlights, red rim and floor pools', 'large white headlines, hard red blocks and sparse red labels', 'direction, access, ambition and constraints', 9, 'written six-second directions; not observed motion'),
 'style-4': ('cream, espresso and vivid orange', 'warm dot grid, faint diagonals and peach corners', 'cream clay, orange gloss, expressive figure and worn wood', 'warm upper-left light and long soft brown shadows', 'espresso headlines; source white-on-orange needs contrast correction', 'action, waiting and visibility', 9, 'motion file empty; all designed motion must be labeled inferred'),
 'style-5': ('deep emerald, ivory and electric lime', 'dark-green square grid, sparse lines and organic corners', 'green metal, pearl objects and lime glow', 'cinematic green floor light and lime rims', 'ivory headlines; dark-green lettering inside lime emphasis', 'comparison, conversion, tailored help', 10, 'motion file empty; all designed motion must be labeled inferred'),
 'style-6': ('near-black, white and vivid red', 'dark square grid and rounded inset panels', 'black gloss, red glass/metal and white figures', 'strong red reflections, rim light and floor pools', 'giant white statements; red bands or hanging top labels', 'diagnosis, intervention and measurable contrast', 9, 'motion file empty; all designed motion must be labeled inferred'),
 'style-7': ('pale lavender, violet, indigo and pearl', 'subtle dot grid, faint lines, blurred pink/violet corners', 'violet glass, pearl surfaces, gem facets and translucent liquid', 'large diffused source, soft violet shadows and reflections', 'indigo headlines, rounded violet pills and mixed foreground/background text', 'value, completeness and quality', 7, 'motion file empty; all designed motion must be labeled inferred')
}

def inventory():
 styles = {}
 for style, observations in OBSERVATIONS.items():
  folder=ROOT/'references/styles/custom-motion-shorts'/style
  images=sorted(folder.glob('*.jpg'))
  if len(images)!=len(observations):
   raise ValueError(f'{style}: inventory changed; inspect every image before updating')
  palette,background,materials,lighting,typography,meaning,prompt_count,motion=DETAILS[style]
  records=[{'path':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'observation':observation} for p,observation in zip(images,observations)]
  sources=[{'path':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(folder.iterdir()) if p.is_file()]
  styles[style]={'reviewedAt':'2026-10-29','reviewBasis':'Every supplied image opened individually by the agent; observations are editorial, not automatic similarity scores.',
   'palette':palette,'background':background,'materials':materials,'lighting':lighting,'typography':typography,'meaning':meaning,
   'composition':'Dominant physical mechanism, variable top/bottom/side text, deliberate overlap and breathing room; at most two supporting accents.',
   'motionEvidence':motion,'imageCount':len(records),'promptSceneCount':prompt_count,'missingImages':prompt_count-len(records),'images':records,'sources':sources}
 destination=ROOT/'config/reference-evidence.json'
 destination.write_text(json.dumps({'version':1,'styles':styles},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(destination)

if __name__=='__main__': inventory()
