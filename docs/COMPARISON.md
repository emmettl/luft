# Canvas / Three.js comparison — LUFT 0.2.0

- [Canvas](https://emmettl.github.io/luft/?renderer=canvas)
- [Three.js](https://emmettl.github.io/luft/?renderer=three)

Choose **Aircraft renderer** to switch without losing the clock, map view, carrier or airport. Canvas remains the default. Three.js loads on demand. WebGL failure or context loss returns to Canvas with a visible explanation.

For a useful comparison in Windows Edge:

1. Open either link and use the same window size for both runs. Start with all aircraft, Europe and 07:00 UTC.
2. Run a short section once to warm its data, pause, and seek back to 07:00. Use the same playback pace for both renderers.
3. Select a renderer, open **Device details**, and choose **Reset measurements**. Play the section, pause and **Copy results**. Repeat for the other renderer. Buffering time is reported separately; if it differs substantially, repeat the section after loading.
4. Try Britain, an airport highlight and an individual airline too. Report perceived smoothness, any input lag, and whether the device becomes hot, alongside the copied JSON.

Both paths currently cap map painting at about 30 Hz. A paint interval near 33 ms is therefore expected even on a fast renderer. CPU draw p95 measures JavaScript and submission, not asynchronous GPU completion. Paint intervals reveal some main-thread stalls but do not measure presentation latency. Treat a lower CPU number alone as insufficient evidence of smoother output. Copy results records renderer, browser, viewport/DPR, date, selection, view, clock, pace, sample count, CPU p95, paint intervals, buffering and GPU draw calls. It copies locally; no telemetry is sent.

## Scope of the prototype

Three.js replaces only the moving aircraft and trails. The same `AirMap` code resolves positions from shared core, preserves gaps, chooses visible tracks, counts aircraft, assigns selection colours and constructs the three-minute trail. Picking still uses those exact projected heads. Land, labels and hourly density stay in Canvas; the timeline and airport cards are unchanged. Shader anti-aliasing and overlap ordering can differ slightly, but the observations and time semantics do not.

The GPU backend uses three ordered layers: ordinary traffic, airport-associated traffic, and the selected flight. Each layer has instanced trail quads and a point batch, with at most six draw calls. Buffers grow geometrically and are reused. It imports `updateDirtyGeometry` from the shared Three.js performance entry point and uses the same core paused-frame guard as Canvas. Switching back disposes geometry, materials and the WebGL context.

This prototype still samples positions and prepares trail vertices on the CPU every painted frame. It is a batched GPU drawing comparison, not yet the shared train renderer's shader motion/interpolation or adaptive trail scheduler. Adding those mechanisms to observed aircraft would need its own gap/seek and fidelity tests. The comparison can therefore show whether draw submission is worth further GPU work without simultaneously changing the motion model or data loader.
