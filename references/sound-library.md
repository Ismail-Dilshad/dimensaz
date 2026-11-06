# Reusable sound library

All 31 user-provided sounds were moved from sounds/ into assets/sfx/ without changing
bytes. Names describe available filename hints; classifications have not been established
by audition. Five incomplete source descriptions remain in unclassified/ rather than
receiving invented identities. Each file has a JSON sidecar with original filename,
content hash, category, tags and import history. No licensing evidence was supplied;
license stays null and automatic CC0-only selection does not assume commercial rights.

Categories: clicks, digital, notifications, pops, success, ticks, typing, whooshes,
and unclassified. Existing impacts category remains supported for future acquisitions.
Run pnpm sfx:index after changes. Its JSON index includes duration, hash and RMS level.

For future videos, inspect local metadata and audition promising effects first. When
none fits, the agent should use available web research/browser tools to find an official
licensed source, verify intended use and attribution, download and audition it, then
register it in the same library. Prefer consistency and subtle effects; voice remains
primary. No need to ask the user for routine sourcing already authorized here. Login,
payment, access controls and unresolved licensing still require user intervention.

`pnpm sfx:acquire --manifest METADATA.json --url HTTPS_URL` uses the existing bounded
HTTPS downloader, exact authorized redirect hosts, SHA-256 deduplication, probing and
full decode before import. Alternatively supply --file for authorized browser downloads.
Metadata fields: name, category, format (wav/mp3/ogg/flac/m4a), sourceUrl, creator (nullable),
license, licenseEvidence, commercial:true, verified:true, attribution, tags, authorizedHosts.
The agent must verify evidence before setting those flags. Limits: 25 MiB, one audio
stream, no video, up to 120 seconds. Larger music tracks require a separate workflow.
Downloads require an authorized production or collection request. Live sourcing remains
subject to environment/network availability; preserve source and license evidence.

Remove only proven exact duplicates when requested. Compare original SHA-256 hashes;
for differing containers/tags also compare decoded float32 PCM hashes with matching
sample rate and channel count. Similar names, durations or audible effects are insufficient.
Keep a deletion/alias receipt if any are removed. Existing project imports and MP4 exports
are independent and must never be deleted as part of sound-library deduplication.

Original collection verification: 31 distinct original file hashes and 31 distinct decoded PCM signatures; no duplicates removed. All collection files decoded successfully. The empty sounds directory was removed after hash verification. Isolated synthetic import and duplicate-reuse checks passed without adding test sounds to the collection.

## Verified collection expansion

The user's collection-expansion request authorized downloading Kenney's Interface Sounds
from the creator-published source https://opengameart.org/content/interface-sounds.
The original archive contains 100 OGG sounds and a CC0 license. It is retained under
workspace/reference-production-assets/providers/kenney-interface-sounds.zip with the
license text and a hashed source receipt. Eight effects were individually imported through
sfx:acquire: click, confirmation, drop, maximize, minimize, open, scroll and switch.
The index now includes these eight licensed effects alongside the 31 existing sounds;
the existing sounds' unresolved rights were not changed. All imported files were decoded
and probed, with hashes, provider URLs and license evidence recorded in sidecars.

providers/audition.mp3 combines a local candidate and the eight new candidates. This
session could not listen to audio, so auditory quality remains unreviewed. The demo's
three event sounds are technically verified but are not claimed to have been auditioned.

