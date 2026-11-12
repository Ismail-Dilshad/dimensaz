# Free sources: 3D, textures, HDRIs, images, icons, video, sounds and reference videos

`pnpm tempoloom source` finds and downloads free, license-clear assets by itself and
records the license of every item. It is the first place to look when the production
design lists an asset the user did not supply and the library does not have.

## Providers

| Kind (`--kind`) | Default providers | Key in `.env` | License |
| --- | --- | --- | --- |
| `model` (glTF 3D), `texture` (PBR maps), `hdri` | Poly Haven | none | CC0; credit "Powered by Poly Haven" is appreciated |
| `icon` | Iconify (200,000+ open icons) | none | Per icon set (MIT, Apache, CC BY…); checked per result |
| `image` | Openverse, Pexels, Pixabay | Pexels and Pixabay keys | CC0 / CC BY (Openverse, filtered to commercial use), Pexels License, Pixabay License |
| `video` | Pexels, Pixabay | `PEXELS_API_KEY`, `PIXABAY_API_KEY` | Pexels License, Pixabay License |
| `sound` | Freesound, Openverse | `FREESOUND_API_KEY` | CC0 and CC BY only |
| `music` | Openverse | none | CC0 / CC BY, commercial use allowed |
| reference videos | yt-dlp (YouTube, Vimeo and most video sites) | none | Study only, always |

All keys are free: [Pexels](https://www.pexels.com/api/),
[Pixabay](https://pixabay.com/api/docs/), [Freesound](https://freesound.org/apiv2/apply/).
Providers without a key are skipped and say which key to add.

## License rules (automatic)

Every result is classified before it can be downloaded:

- **final**: may appear in videos. CC0, public domain, Pexels, Pixabay, CC BY (with the
  attribution line), MIT, Apache, BSD, ISC, OFL, Unlicense.
- **study**: reference only, never in a final video. CC BY-SA, GPL, and every reference
  video downloaded with yt-dlp.
- **blocked**: never downloaded. Non-commercial (NC), no-derivatives (ND), and any
  license that is missing or not recognised.

`search` shows only final-use items unless `--all`. Each download is saved to
`workspace/downloads/<kind>/<provider>-<id>/` with a `source.json` holding the page,
creator, license, attribution line, file hashes and the usage rule.

## Commands

```bash
pnpm tempoloom source search "office chair" --kind model
pnpm tempoloom source search "rocket launch" --kind icon --limit 12
pnpm tempoloom source search "city night" --kind video --orientation portrait
pnpm tempoloom source search "whoosh" --kind sound
pnpm tempoloom source get 1 3              # numbers from the last search, or provider:id
pnpm tempoloom source get polyhaven:wooden_chair --kind model --resolution 2k
pnpm tempoloom source render-3d workspace/downloads/model/polyhaven-ID/FILE.gltf --turntable 4
pnpm tempoloom source reference https://www.youtube.com/watch?v=ID            # info only
pnpm tempoloom source reference https://www.youtube.com/watch?v=ID --confirm --section 0-30
pnpm tempoloom source list
pnpm tempoloom source credits              # attribution lines for the video description
pnpm tempoloom source doctor               # keys, yt-dlp, one live search per provider
```

`render-3d` turns a glTF/GLB model into transparent PNG views (front, three-quarter,
side, back, top) and an optional transparent turntable (`.mov`, ProRes 4444) with
three.js in Chromium, framed automatically with neutral studio light. `--color #HEX`
renders it in one brand colour; `--background #HEX` gives an opaque result.

## How the agent uses it

1. **Prepare stage**: for each asset the production design marks as "need", search the
   library first, then `source search` with the right kind. Look at the previews (open
   the preview links or the downloaded file) and pick by relevance and style, not by
   the first result.
2. `source get` the chosen items. Use 3D models through `render-3d` (views or turntable),
   textures and HDRIs as backgrounds and materials, icons as SVG, video as b-roll,
   sounds as effects.
3. To keep an item for future videos, import it into the asset library with
   `pnpm assets:library import --manifest METADATA --file FILE`, using the license from
   its `source.json`.
4. **Reference videos**: run `source reference URL` first, tell the user the title,
   length and size, and download with `--confirm` only after they agree. Then measure it
   with `pnpm tempoloom media style FILE` or `media scenes FILE`. Never put a reference
   video, its frames or its audio in a final video.
5. **Deliver stage**: run `source credits` and give the user the attribution lines for
   the description or end credits whenever an item needs them.

## Limits

- Searches need internet access to the provider APIs; nothing is cached between searches
  except the last result list.
- Freesound downloads the high-quality MP3 preview (the original file needs OAuth).
- Downloads larger than `SOURCE_MAX_MB` (400 MB) are refused.
- A license is what the provider reports. For anything important (a logo-like icon, a
  person's face, a product in a photo), open the item page and check it by hand.
- People in stock photos and videos need no release for normal use, but never imply
  that a real person endorses the product.
