# LUFT rendering audit — 16 September 2026

LUFT uses Canvas 2D for its continent-wide observed-aircraft map. It already consumes `positionForAirTrack` from shared core, including Hermite interpolation, binary sample lookup and the 45-second gap limit. Airport search, movement associations and cards are shared; the new timeline also uses core geometry and the shared web component.

The map itself does not use the Three.js renderer. Its GPU upload ranges, instanced geometry, shader interpolation, adaptive motion/trail budgets and ground-camera culling cannot be switched on in this Canvas layer. The shared `AirTrafficLayer` also presents aircraft in a 3D projection; replacing LUFT with that layer would require a measured renderer migration, not just a dependency upgrade. Train motion budgets assume journey sampling contracts different from recorded aircraft observations.

## Changes

- **Shared paused-frame guard.** `PausedVehicleFrame` now lives at `@motionstudies/core/render-frame`; the existing Three.js entry point re-exports the identical implementation. LUFT records only actual paints. Time, carrier data, airport/aircraft selection, mode, view, size and pixel-density changes invalidate its frame. Density repaints when its hour/series changes, not when seconds advance within the same hour.
- **Cached land.** Project and rasterize land once per view/size change, then composite that layer beneath moving traffic. ResizeObserver invalidates dimensions; repeated frames avoid layout reads. The cache adds one bounded canvas at the existing capped 2× pixel density (about 4 MiB at a 390×664 viewport, 22 MiB at 1440×1000). It is released on disposal.
- **Conservative culling.** Per-track extents are weakly cached from the current decoded track objects. A track wholly outside the viewport takes no Canvas draw commands. Extents include all its samples and interpolated head, so a visible trail is retained even when its head is outside. Counts still cover the whole study window; culling does not redefine the data or filter the airport board. Discarded chunks are not retained by the weak cache.
- **Less per-frame work.** Three stable drawing layers replace sorting all aircraft. Scalar projection avoids allocating an array for every trail vertex. Default airport labels are selected once. Selected aircraft still render above other traffic, and picking uses visible heads.
- **Clock/UI separation.** Cached playback seeks no longer rerender React or refresh the prefetch set on every animation callback. The canvas keeps its existing roughly 30 Hz draw cadence; React clock/board updates are capped at 5 Hz, with immediate explicit seek/play/pause/loading changes. Prefetch advances at chunk boundaries. Identical paused UI updates return the previous state.

The animation callback still runs while paused to check for changes. This removes map painting and repeated React commits, not every browser callback. A fully event-driven idle loop remains possible if physical-device energy measurements justify the extra lifecycle complexity.

## Measured evidence

Run `LUFT_PROFILE=1 npm run test:browser -- render-profile.spec.ts --workers=1` against the local dev server. The opt-in test counts main-canvas commands, records a one-second idle window, then plays 2.5 seconds at 15 minutes/second from 07:00. It tests Europe and Britain. Raw output and browser/viewport details are in [the evidence file](evidence/render-work-2026-09-16.json).

| Local browser / view | Paused paints per second, before → after | Playback line commands per paint, before → after | Reported draw p95, before → after |
| --- | --- | --- | --- |
| Chromium / Europe | 30 → 0 | 38,362 → 33,366 | 5.8 → 6.0 ms |
| Chromium / Britain | 31 → 0 | 38,369 → 23,354 | 5.7 → 5.7 ms |
| WebKit phone viewport / Europe | 30 → 0 | 38,362 → 33,363 | 12.0 → 12.0 ms |
| WebKit phone viewport / Britain | 30 → 0 | 38,366 → 26,775 | 11.0 → 11.0 ms |

These are single instrumented local runs. Counters add overhead, and p95 is the rolling app statistic, including startup, view changes and warm-up; it is not an isolated playback percentile. The reductions in submitted work and paused paints are demonstrated. Moving-frame speed improvement is not established. Phone-sized WebKit on a Mac does not establish physical iPhone performance. Draw timing also excludes asynchronous raster completion, chunk decompression, React/layout and network latency.

## GPU comparison in 0.2.0

A switchable batched Three.js aircraft layer is now available for device evaluation. See [the comparison guide](COMPARISON.md). The before/after table above measures the earlier Canvas optimisation, not Canvas versus Three.js.

## Next useful measurements

1. Test on a physical phone: paused energy/heat, playback at all three paces, memory after several carrier/view changes, and chunk-boundary stalls. The rolling p95 alone cannot identify decode or network bottlenecks.
2. Profile decompression and JSON parsing at 900× before adding a worker. Ten-minute chunks are consumed every two-thirds of a second; moving parsing off the UI thread may matter more than faster drawing if decode dominates. Keep the four-chunk budget, cancellation, hashes and last-good-frame semantics.
3. If drawing remains dominant, benchmark a shared GPU aircraft adapter or separately budgeted trails with the same data and visual output. Require exact pause/seek, gap preservation, correct picking/selection and recovery after context loss. Avoid reducing observation fidelity simply to improve a frame counter.

Unit tests cover idle invalidation, cached land, resize/selection/data changes, offscreen counts, crossing trails, density invalidation and gap preservation. The browser regression suite covers airport/carrier filtering, fast streaming, failed-chunk retry, midnight looping and responsive controls. The shared packed-consumer check protects the existing Three.js import as well as the new core entry point.

## Retained GPU follow-up — 0.2.1

The first Windows Edge comparison favoured Canvas. The follow-up retains timestamped trails in minute batches, updates aircraft state in a compact texture, and exposes CPU stage timings. Canvas stays the default. See [the comparison guide](COMPARISON.md) for the rendering contract, device procedure, limitations and evidence; the earlier Canvas table above is not a measurement of this GPU change.

## Movement accents · 0.3.6

A small gold ring expands at an observed departure, and a cyan ring contracts at an observed arrival. These are the existing airport-linked endpoint observations, not confirmed wheels-up or touchdown events. An endpoint must carry `observed-endpoint` evidence and have a valid locally sampled position; ordinary chunk starts/ends and coverage gaps do not generate hints.

Events are cached per track array and deduplicated by aircraft, kind, airport and time. The accent lasts one second on a separate playback animation clock, independent of study pace. It freezes while paused, buffering or scrubbing; explicit seeks, filter changes, backwards loops and density mode clear it. Reduced-motion preference disables the effect. A landing hint can finish at its observed location after its aircraft leaves the active samples.

Canvas and Three.js share a small decorative 2D overlay. It does not intercept pointer input or invalidate the cached land/GPU background. Overlay painting contributes to total map CPU draw time; it is separate from the aircraft geometry/submission stage measurements. The overlay clears only while hints are present or ending. It adds one viewport-sized canvas at the existing capped pixel ratio.

Validation covers evidence and interpolation gaps, deduplication, pause/expiry/reset behaviour, pixel output and colours in both render paths, retained GPU geometry, reduced motion, filtering, touch input and playback. Local results: 27 unit/data checks and 25 Chromium checks pass; two profiling scenarios remain opt-in.

## Observation fade-in (0.3.8)

Newly visible observed tracks, including returns after gaps longer than 45 study
seconds, blend their heads and trails in over 0.6 seconds of active playback.
Smoothstep opacity uses the same playback clock as movement accents, so pause,
buffering and scrubbing freeze it and playback pace does not shorten it. Gaps
crossed between two fast frames are detected from cached sample discontinuities.
The shared sampler still decides position validity; no position is extrapolated
or painted during an observation gap.

Initial loading, seeking, looping, filter changes and returning from density
prime the current scene immediately. Chunk replacements and renderer changes
preserve in-progress fades; panning does not trigger new fades. Reduced-motion
preference disables both fades and movement accents. Counts and picking retain
the observed population throughout the transition.

Canvas multiplies the existing aircraft opacity. Three.js carries fade opacity
in the existing state texture's visibility channel, multiplying the shader's
filter emphasis. The texture size, upload bytes, retained geometry and draw-call
structure are unchanged. Unit and browser pixel checks cover pauses, gaps skipped
at fast playback, chunk continuity, seeking, reduced motion, filter dimming and
both renderers.
