# GPU debugging

## Opt-in GPU debugging

Uses the published `@motionstudies/*` alpha.48 packages. Normal URLs load no GPU debug tools. Add `debug=capture` to the query to capture the selected WebGL renderer, inspect it or download native Spector JSON with edition metadata. Collapse the debug panel when using controls beneath it on a small screen. Exit debugging through its reload link to remove instrumentation before baseline measurements.

Use `?renderer=three&debug=capture` beneath the `/luft/` base path. The renderer selector lists the active GPU aircraft layer; switching to Canvas 2D or losing the context retires that registration. Re-enabling GPU registers it once. Spector captures instanced trails and the state-texture work; exports include the pinned data-release hash, actual time, selected aircraft, geographic projection, viewport and work counters. The raw Three renderer uses capture and observations; it does not mount a Fiber profiler.

Check the production build with `LUFT_TEST_PORT=4811 LUFT_TEST_PREVIEW=1 npm run test:browser -- tests/gpu-debug.spec.ts --workers=1`.
