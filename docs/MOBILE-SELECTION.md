# LUFT 0.3.0 · one search, more map

The iPhone layout replaces separate airport and carrier selectors with a single search and removable pills. Available airline marks appear inside the pills. Renderer, density and chart choices move into View; airport boards open on request and scroll above the playback dock. The alpha.23 shared timeline remains in use.

Selections union within each category and intersect across categories. For example, SWISS + easyJet includes both carriers; adding ZRH restricts them to tracks associated with Zürich. Multiple airport pills mean either airport, not a connection between them. A route pill selects a known endpoint pair in either direction. Unknown endpoints are excluded from airport/route matches. All results remain inferred from observations, not confirmed flight schedules.

The map, activity chart, hourly density and board use the same canonical track selection. Airport arrival colour takes precedence where both endpoints are selected. Clearing pills preserves time, pace, renderer and view. The GPU still retains trail geometry between frames and rebuilds when the actual track or airport selection changes.

## Filter activity

The build derives `snapshots.json` from the pinned, hash-verified chunks. Each track has flat triples of five-minute tick, longitude cell and latitude cell. Only the chunk's half-open delivery window contributes; trail/forward overlap does not. The reference index provides canonical track IDs, operator callsigns, aircraft identities and inferred endpoints.

This adds about 5 MB JSON / 1.6 MB gzip, loaded with the reference index. Arbitrary combinations then calculate locally without downloading detailed chunks. Counts deduplicate aircraft identity per tick. The published per-airline snapshot counts provide independent regression fixtures. The activity now describes observations present in playable track chunks; isolated source observations absent from those chunks are not invented.

Hour density uses these five-minute observations in half-degree cells. This changes its sampling from every raw observation in 0.2.x. It is labelled accordingly. Flights between ticks can be absent from snapshots; density remains normalized within an hour and selection. Detailed motion continues using original chunk samples and the existing 45-second gap rule.

## Validation

- Typecheck, production build and 21 unit/data tests pass locally.
- 17 Chromium browser checks pass, including combined selections, unknown/empty intersections, route search, clear/remove, short phone layouts, keyboard viewport resizing, 44px primary touch targets, keyboard behaviour, fast playback, looping, GPU fallback and disk-cache reuse. Two profiling checks remain opt-in.
- Visual inspection at 390×730 and automated 375×600 checks reserve space for the map and keep attribution, search and timeline within the viewport.
- Local WebKit can open a data URL but stalls before HTTP navigation; GitHub Actions passed the WebKit/iPhone regression suite in run 35134059651 before Pages deployment. Browser emulation is not a physical iPhone measurement.

## LUFT 0.3.2 · laptop framing

At widths of 1000px and above, playback controls sit alongside the shared timeline in a shallow dock. At 1366×700 it measures 131px high, with a 48px scrub target and 44px primary controls. The map reserves less space below it to use the recovered height. Narrow screens retain the stacked layout.

The land outside the recorder manifest's study bounds fades over four degrees into the background. This is part of the cached land image, rebuilt only when the view or size changes, and works with both aircraft renderers. Observed aircraft and density values are not attenuated. The zoom-out limit uses the manifest bounds and preserves the current view's aspect ratio; the Europe button restores the complete study extent.

Validation: production build, 23 unit/data checks and 20 Chromium browser checks pass locally (two optional profiles skipped). Laptop, short laptop and phone screenshots were reviewed; the full deployment suite also runs iPhone WebKit.

## LUFT 0.3.4 · touch selection

Search results no longer disappear solely because the input loses focus. A mobile keyboard can blur the input before the result receives its click, removing the target before selection. The search now dismisses for an actual pointer action or focus outside the widget, Escape, or its close button. Touch pointer-down keeps the native behaviour; selection remains on click, so a cancelled scroll gesture does not select an option.

Added browser checks use real touch taps for airlines, airports, routes, pill removal and clearing. They also reproduce blur before activation (fails before this change), cancelled touch gestures, outside taps and keyboard focus leaving the widget. Production build, 23 unit checks and 10 targeted Chromium checks pass locally; deployment runs the same touch checks in iPhone WebKit.

### LUFT 0.3.5 · suggestion stacking

The open search container rises above the playback dock. Previously the phone's default airline suggestions (including SWISS) extended into the dock, whose stacking layer intercepted taps. A touch regression selects SWISS from the untyped list where it overlaps the dock, alongside the keyboard-blur checks from 0.3.4.
