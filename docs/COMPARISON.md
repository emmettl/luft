# Canvas / Three.js comparison — LUFT 0.2.2

- [Canvas](https://emmettl.github.io/luft/?renderer=canvas)
- [Three.js](https://emmettl.github.io/luft/?renderer=three)

Choose **Aircraft renderer** to switch without losing the clock, map view, carrier or airport. Canvas remains the default. Three.js loads on demand. WebGL failure or context loss returns to Canvas with a visible explanation. **Device details** shows the version; refresh an older tab before comparing.

Version 0.2.2 adds [persistent compressed chunk reuse](CHUNK-CACHE.md), while retaining the same renderer. Warming a section now populates a disk cache as well as the four-chunk decoded RAM window. The response counter no longer labels HTTP-cache responses as downloads.

## Windows Edge comparison

1. Keep the same window size for both runs. Start with all aircraft, Europe and 07:00 UTC.
2. Play a short section once to warm its data, pause, and seek back to 07:00. Use the same playback pace for both renderers.
3. Select a renderer, open **Device details**, and choose **Reset measurements**. Play the section, pause and **Copy results**. Repeat for the other renderer. If buffering differs substantially, repeat after loading.
4. Try Britain, an airport highlight and an individual airline too. Report perceived smoothness, input lag and heat alongside the copied JSON.

Both paths cap painting at about 30 Hz. A paint interval near 33 ms is expected even on a fast renderer. CPU draw p95 measures JavaScript and submission, not asynchronous GPU completion. Paint intervals reveal some main-thread stalls but do not measure presentation latency. A lower CPU number alone does not establish smoother output.

Version 0.2.1 adds CPU stage p95 timings: **setup** (size, projection, map base), **sampling** (shared positions, culling, counts and picking; GPU state packing), **geometry** (retained GPU geometry preparation, or Canvas drawing commands), and **submission** (GPU texture update and render call). These percentiles are calculated independently and should not be added together. Total draw maximum helps expose occasional chunk/selection preparation costs that p95 can hide. All frame statistics cover at most the latest 300 paints since reset.

GPU details also show bytes of geometry **rebuilt** in the latest frame, bytes in the aircraft state texture submitted per frame, and the lifetime geometry build count for that renderer. Geometry preparation bytes are not measured driver transfer bytes: minute batches upload lazily on first use. Resetting measurements does not rebuild geometry or flush data. Copy results includes these counters, stage timings, version, browser, viewport/DPR, date, selection, view, clock, pace, sample count, CPU p95/maximum, paint intervals and buffering. It copies locally; no telemetry is sent.

## What changed after the first device comparison

The supplied Windows Edge photos of 0.2.0 showed Canvas map draw p95 **42.5 ms** versus Three.js **72.2 ms**; paint interval p95 was **83.6 ms** versus **99.9 ms**, with no measured buffering in either. The playback positions differed and the sample counts/device configuration were not captured, so these are useful field observations rather than a controlled benchmark. They are evidence against promoting the first GPU implementation to the default.

The original GPU path rebuilt each visible trail, style and point buffer every frame. Version 0.2.1 retains geographic sample pairs and their timestamps for the current chunk/filter/selection. Playback, scrubbing, pan, zoom and pixel-density changes reuse that geometry. Chunk, carrier, airport or selected-flight changes rebuild it and release the previous buffers.

Minute-sized batches outside the trailing window are skipped entirely. Within visible batches, vertex shaders enforce the exact three-minute sample boundary and connect the most recent sample to the current head. For ordinary traffic this normally means four or five draw calls; airport and selected-flight layers can increase the total to fifteen. This intentionally trades a few calls for less hidden vertex work. A single batch for the entire chunk proved too expensive in local testing.

Each painted frame samples aircraft positions through the unchanged shared `positionForAirTrack`, writes a compact RGBA float texture (longitude, latitude, active flag, altitude), updates the time/projection uniforms and submits visible batches. For the 07:00 all-aircraft chunk, this texture is 64 KiB; retained geometry is roughly 4.7 MiB. CPU per-frame trail traversal, projection, colour parsing and vertex uploads are removed. The shared paused-frame guard still avoids unchanged paints.

Heads retain core's Hermite interpolation, including the 45-second gap limit. Counts, culling and picking use the same positions as Canvas. There is no new GPU motion model or extrapolation across missing observations. Land, labels, hourly density, timeline and airport cards are unchanged. Shader anti-aliasing and overlap order can differ slightly. The static geometry no longer needs the shared dynamic-buffer upload helper; the fixture for the old renderer retains it for comparison.

## Verification and remaining limits

Pixel-level browser tests check completed and partial trails, exact sample times, gaps, expired tails, backward seeks, empty selections and geometry reuse across time/view/DPR changes. Existing tests cover carrier/airport state, chunk transitions, midnight looping, density and WebGL recovery in Chromium and phone-sized WebKit.

Run `LUFT_GPU_PROFILE=local npm run test:browser -- tests/gpu-profile.spec.ts --project=chromium --workers=1` for an opt-in comparison of Canvas, the released 0.2.0 GPU path and the retained renderer. It replays identical times from one verified chunk in each mode, discarding warm-up frames. The old renderer sources live only in test fixtures and are not shipped in the site. Results are local CPU evidence, not Windows performance claims; see [the evidence file](evidence/gpu-comparison-2026-09-16.json).

In the recorded local replay, CPU draw p95 was **3.2 ms Canvas**, **3.7 ms original GPU**, and **2.2 ms retained GPU** (70 measured frames per path after 10 warm-up frames). The retained path rebuilt geometry once, then reported zero geometry preparation during replay and a 64 KiB state texture per frame. This is about 41% less CPU draw time than the original GPU path in this run; it does not establish GPU completion time or Windows performance.

Position sampling, texture uploads, chunk decoding and React/layout still use the main thread. Preparing a new chunk can cause a spike. Weak or software GPU implementations may still favour Canvas. Keep Canvas as default until real-device evidence supports a change.
