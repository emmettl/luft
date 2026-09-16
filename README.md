# LUFT

A recorded day of aircraft movement over Europe. A Motion Studies research edition, opening at the continental scale: London, Paris and other places emerge through the accumulation of movement. The artistic thesis remains open; LUFT is an early study, without a catalogue number.

**[Open LUFT](https://emmettl.github.io/luft/)** · [Dated source data](https://github.com/emmettl/luft/releases/tag/air-2026-09-14-v1)

Search by airport, city, IATA or ICAO code. Selecting an airport keeps the wider European view, highlights inbound tracks in blue and outbound tracks in gold, and dims unrelated traffic. The shared Motion Studies airport card shows observed departure/arrival associations near the study clock. Select a board flight to seek to its observed boundary and highlight the track. “Near” offers a closer view; Europe restores the opening extent. Drag/pinch or use the zoom controls.

## Follow an airline

Select easyJet, SWISS or British Airways to follow its observed network through the day. The selection applies to moving tracks, airport boards, the daily activity strip and hourly density. It preserves the clock, playback pace and selected airport. Clear it with “All aircraft”.

The filter uses operating callsigns: easyJet groups EZY/EJU/EZS; SWISS uses SWR; British Airways groups BAW/SHT/CFE/EFW. These identifiers were checked against the [FAA airline designator table](https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/chap3_section_3.html). This is not ownership or marketing codeshare matching: unidentified callsigns and partner-operated flights can be missing. The recorded day contains 361 easyJet, 97 SWISS and 264 BA-group aircraft identities within the study window, not their entire worldwide fleets.

`npm run dev` and `npm run build` first calculate airline summaries from the verified, pinned recorder chunks. Delivery overlap is excluded and aircraft identities are deduplicated. The generated, ignored `src/generated/airlines.json` becomes a separate hashed asset (about 635 kB before HTTP compression). No paid API calls, API keys or recorder changes are needed, and playback still streams only nearby chunks. Run a build before the unit tests on a fresh checkout.

## Run

Node 24+, npm 11.19.0:

```sh
npm ci
npm run data:fetch
npm run dev
```

The app is served beneath `/luft/`. `npm run data:fetch` downloads the **explicitly pinned** recorder archive in `data-release.json`, verifies its archive and manifest hashes, then verifies every file. Existing local data is checked, never silently overwritten. `public/data/` is generated and ignored. No sibling checkout, private API key or recorder runtime is needed.

```sh
npm run build
npm test
npx playwright install chromium webkit
npm run test:browser
```

GitHub Actions performs these checks, imports the pinned release, and deploys the built site to GitHub Pages on `main`.

## What the first release contains

14 September 2026, 00:00–24:00 UTC. The shared recorder exporter consumes retained ADSB.lol heatmaps from a content-addressed source store. It verifies all 48 half-hour inputs and uses the published Motion Studies decoder, transport filter and endpoint inference. Canonical track IDs and full-trace endpoint evidence are computed before clipping to playback chunks and the viewing rectangle.

- 10,137 observed aircraft identities; 40,945 track segments, **not a census of flights**.
- 1,080 searchable large/medium airports in `[-25,34,45,72]`. This is a viewing window, not a political mask of Europe.
- 144 ten-minute compressed track chunks with three-minute trail and 45-second forward overlap.
- Approximately 264 MB for the whole release; a roughly 1.8 MB compressed index, small land context, then the current chunk and up to three ahead. The entire day is not loaded into memory.
- Airport inference uses the complete retained global trace and conservative proximity, altitude, speed and ambiguity checks. Unknown endpoints remain blank. Times are observed boundaries, not schedules, gate events or confirmed flight plans. Associations can be incomplete or wrong, especially at receiver gaps and day edges.

The first release reuses captures already acquired for the Europe proof. It is exported by `motionstudies-recorder` commit `e0e506ad49f011f754bc2653c916992acd6cee89` ([isolated exporter PR](https://github.com/emmettl/motionstudies-recorder/pull/5)). It has **no connection to the ongoing live recorder cutover**, enrollment, launchd or storage migration. A later date needs an explicit recorder export, new public data release and lock update. This is not an automatically updating or live feed.

## Playback and device evaluation

The browser verifies each compressed chunk's SHA-256. A short look-ahead cache shares in-flight requests. Seeking cancels obsolete requests. Late chunks hold the last frame and the clock without flashing a loading overlay; failed loads pause and offer a retry. Gaps over 45 seconds are never interpolated or joined by a trail. Hidden tabs pause playback.

“Device details” shows local map draw p95, cached chunk count and downloaded track bytes. These measurements stay on the device. Draw timing excludes decoding/layout/network and is not a frame-rate benchmark. During buffering, the last displayed chunk can remain referenced in addition to the four desired cache entries. At 15 minutes per second, a ten-minute chunk is consumed in two-thirds of a second, so bandwidth and decoding still matter: this public build enables real-phone evaluation, it does not establish real-phone performance.

Desktop Chromium and phone-sized WebKit on a Mac passed airport search, the shared card, map selection, fast chunk rollover, missing-data hold/retry and horizontal overflow checks. The browser tests are not a physical iPhone test. Hour density is relative within each selected airline/hour and cannot compare volume between airlines or hours. Reception coverage is uneven; missing observations do not mean no flights.

## Data and code

Aircraft data and this derived database: **ADSB.lol and its contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)**. Raw source URLs/hashes and compilation/reference hashes are included in the downloadable release manifest. The derived database is freely downloadable from the release linked above.

Airport reference: [OurAirports](https://ourairports.com/data/), public domain. Land context: [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), public domain, pinned geography SHA-256 in the manifest. Code: MIT. Dependencies on `@motionstudies/core` and `@motionstudies/web` are pinned to `0.1.0-alpha.21`, including the shared airport search, movement board, card and trajectory interpolation.
