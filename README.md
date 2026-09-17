# LUFT

A recorded day of aircraft movement over Europe. A Motion Studies research edition, opening at the continental scale: London, Paris and other places emerge through the accumulation of movement. The artistic thesis remains open; LUFT is an early study, without a catalogue number.

**[Open LUFT](https://emmettl.github.io/luft/)** · [Dated source data](https://github.com/emmettl/luft/releases/tag/air-2026-09-14-v1)

Use one search for airports, airlines and observed routes. Add several removable pills: **SWISS + easyJet** shows either carrier; adding **ZRH** narrows those airlines to movements associated with Zürich. Multiple airports are alternatives, as are multiple routes. Categories intersect. **LHR ZRH** finds the route in either direction. Unknown endpoints do not match an airport or route filter; associations are inferred observations, not confirmed schedules.

Search a **country** by name or code, such as Switzerland, CH, Germany or UK. Selection gently frames and shades the country, highlights every airport from that country in the study catalogue, and filters flights to those with a known observed endpoint at one of those airports. Countries are alternatives within their group and intersect with airline, airport and route filters. The activity chart, density and boards use the same combined selection. Country pills refocus the map; their × buttons remove them. Airports without observed movements still receive markers; text labels retain collision avoidance. Unknown endpoints and unrelated overflights do not match.

National borders are deliberately faint and cached with the map background. Country geometry comes from the pinned Natural Earth 1:50m dataset, supplemented with 1:10m geometry for small territories absent at that scale. Airport membership uses the exact OurAirports reference hash from the recorded release, including coastal airports and airports whose names mention another country. Boundaries follow Natural Earth's source conventions; Åland and Northern Cyprus geometry is grouped with the country codes used by that airport reference. Only the study's geographic window and airport catalogue are covered. Rebuild the checked-in country asset with `node scripts/build-countries.mjs [countries-50m.geojson] [airports.csv] [countries-10m.geojson]`; all three source hashes and the recorder manifest are verified before writing.

The map, five-minute activity chart, hourly snapshot density and airport boards follow the same selection. Clear individual pills or use **Clear all**. An airport pill or its **board** button opens the shared Motion Studies movement card; closing the board leaves its filter in place. Select a board flight to seek to its observed boundary and highlight the track. Europe restores the continental view. Drag/pinch or use the zoom controls.

Selecting an aircraft on the map or board also highlights its full recorded path with a fine champagne line; its current position remains brighter. **Fit route** frames those observations without changing the clock. Gaps longer than 45 seconds remain gaps, and endpoint rings indicate the first and last recorded positions rather than extrapolated airport connections. The path is simplified to approximately 1 km from the verified recorder chunks during the existing data build. It loads on demand from one of 256 small route files, independently of playback buffering; the complete route archive is never fetched up front.

On phones, a compact search and pills replace separate selectors. Airport boards open separately and scroll above the playback dock. **View** contains Motion / Hour density, Bars / Line and the renderer choice. All primary playback and map controls have 44px touch targets. The shared timeline retains native keyboard controls; LUFT handles pointer dragging across the visible marker area for consistent Safari, mouse and touch behavior. The marker follows the requested time while data loads, then playback resumes only if it was already playing. Unconnected airport labels dim gently during filtering; selected airports, highlighted country airports and endpoints of matching flights stay bright.

Aircraft have luminous heads and fading three-minute trails; selecting a flight adds a restrained halo. Airport selections gently frame the selected places, while Europe and Britain ease back to their regional views. Dragging or zooming interrupts the camera transition. Reduced-motion preferences remove these transitions and panel entrances.

**View → Day / night shading** adds a subtle night boundary beneath the aircraft, calculated from the recorded date and UTC clock using [NOAA's approximate solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF). It is astronomical context, not weather or observed light. Hour density uses the middle of its selected hour. The small shading raster is cached by projection and recorded minute; paused frames remain retained. The clock, grouped map controls and fine champagne timeline playhead share the same instrument-inspired styling.

## Compare renderers

Open **View → Aircraft renderer** to switch between Canvas and the optional Three.js aircraft layer. The clock, view and selections stay in place. [Open Three.js](https://emmettl.github.io/luft/?renderer=three) or [Canvas](https://emmettl.github.io/luft/?renderer=canvas). **Device details** provides resettable timings and **Copy results** for real-device comparisons. See [the comparison guide](docs/COMPARISON.md).

## Airline and route evidence

Search all 33 carriers, including easyJet, SWISS, British Airways, Ryanair, Lufthansa, Air France, KLM, Wizz Air and long-haul operators. Airline pills include available operator marks. The filter uses operating callsigns, with explicit families in [`src/airlines.ts`](src/airlines.ts), checked against the [FAA airline designator table](https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/chap3_section_3.html). This is not ownership or marketing codeshare matching: unidentified callsigns and partner-operated flights can be missing. Counts describe this study window, not entire worldwide fleets.

Routes come from distinct pairs of known observed endpoints. They cover both directions and exclude same-airport pairs. Selecting several airports does not imply a route between them: select a route pill for that. When a flight connects two selected airports, its arrival colour takes precedence.

`npm run dev` and `npm run build` derive a compact snapshot index from verified, pinned recorder chunks. It stores only observations exactly on five-minute ticks, their canonical track IDs and half-degree cells. Delivery overlap is excluded. The browser derives each combined selection locally and deduplicates aircraft identities at each tick. No additional track downloads or paid API requests occur when changing filters. The snapshot asset is about 5 MB JSON (1.6 MB gzip); it loads with the reference index. Existing airline summaries remain a build-time cross-check of the snapshot counts.

**Hour density now counts five-minute snapshots**, rather than every raw observation. It uses 0.5° cells, normalized within each selection/hour. Short flights can occur between ticks; an empty snapshot bin is not evidence of no traffic throughout the interval. Brightness cannot compare volumes across selections or hours. Playback itself continues to use the detailed observations and shared interpolation/gap rules.

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

Playback starts automatically when observations are ready. Scrubbing preserves whether playback is running or paused: the clock follows the gesture, then continues from the chosen time if it was playing.

Press **Space** to play or pause while the map is active. Search fields and focused controls keep their normal keyboard behaviour. Holding Space does not repeatedly toggle playback; playback remains unavailable in Hour density or before observations load.

The browser verifies each compressed chunk's SHA-256. A short look-ahead cache shares in-flight requests. Seeking cancels obsolete requests. Late chunks hold the last frame and the clock without flashing a loading overlay; failed loads pause and offer a retry. Gaps over 45 seconds are never interpolated or joined by a trail. Playback loops automatically from midnight to the start of the recorded day, preserving the airline, airport, map view and pace. The look-ahead cache wraps too, preparing the opening chunks before midnight. Hidden tabs pause playback.

“Device details” shows local map draw p95, cached chunk count and downloaded track bytes. These measurements stay on the device. Draw timing excludes decoding/layout/network and is not a frame-rate benchmark. During buffering, the last displayed chunk can remain referenced in addition to the four desired cache entries. At 15 minutes per second, a ten-minute chunk is consumed in two-thirds of a second, so bandwidth and decoding still matter: this public build enables real-phone evaluation, it does not establish real-phone performance.

Desktop Chromium and phone-sized WebKit on a Mac passed airport search, the shared card, map selection, fast chunk rollover, missing-data hold/retry and horizontal overflow checks. The browser tests are not a physical iPhone test. Hour density is relative within each selected group/hour and cannot compare volume between airlines or hours. Reception coverage is uneven; missing observations do not mean no flights.

See the [rendering audit and measurements](docs/RENDERING.md) for shared primitive usage, idle-frame retention, cached land, conservative culling and remaining device-performance questions.

## Data and code

Aircraft data and this derived database: **ADSB.lol and its contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)**. Raw source URLs/hashes and compilation/reference hashes are included in the downloadable release manifest. The derived database is freely downloadable from the release linked above.

Airport reference: [OurAirports](https://ourairports.com/data/), public domain. Land context: [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), public domain. The 1:50m Europe context is bundled separately from the recorder release; its source revision, SHA-256 and polygon selection are recorded in `src/assets/europe-land-50m.json`. Rebuild it with `npm run data:land` (or `node scripts/build-land.mjs <downloaded-source>`). Coastlines retain the original coordinates and islands; land remains cached between view changes. Code: MIT. Dependencies on `@motionstudies/core` and `@motionstudies/web` are exactly pinned in `package.json`, including the shared airport search, movement board, card, timeline and trajectory interpolation.

Airline marks are bundled SVG assets, displayed in their original colours for identification. See [logo sources and notices](src/assets/airlines/README.md); these marks are separate from the code and aircraft-data licences.

## Replaying cached data

LUFT keeps four decoded chunks in RAM and saves verified compressed chunks on device for loops, backward seeks and reloads. Device details separates fetch response bytes from local-cache reuse. See [chunk-cache behaviour](docs/CHUNK-CACHE.md) for limits and fallback behaviour.

## Destination evidence

The arrow button beside flight search opens **Destinations & continents**. Select arrival or departure, a continent or an airport. Observed and corroborated labels are enabled by default; route-reference candidates require the explicit checkbox. Conflicting evidence stays unresolved. Coverage reports canonical track segments before the endpoint filter, within the existing airline/country/airport/route selection. Unfiltered playback still includes unknown endpoints.

The pinned `enrichment-release.json` descriptor binds `public/enrichment/endpoints.json.gz.bin` to the exact recorded release. Build and browser checks verify its hash and track identities. Published source reports and attribution are retained in `public/enrichment/reports/`. The recorder export command and method are documented in [the recorder](https://github.com/emmettl/motionstudies-recorder/blob/main/docs/AIR-ENDPOINT-EXPORT.md).

For September 14, the default labels cover 22,508 origins and 22,008 destinations out of 40,945 segments: 9 origins and 8 destinations are corroborated across separated observations. Another 14,018 labels are candidate-only and 17 conflicting proposals stay excluded. These are not independently confirmed flights. Selected-flight captions distinguish the evidence. Existing airport boards, country/airport/route search and movement rings continue to use recorded endpoint evidence; enrichment adds no event times or trajectory samples. Continents follow airport geography, including African labels for the Canary Islands.
