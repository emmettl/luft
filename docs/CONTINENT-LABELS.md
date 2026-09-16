# Continent label infrastructure

Continent labels belong to the shared Motion Studies data pipeline. LUFT consumes
them in a dated recorder release; there is no separate Python classification job.

- `@motionstudies/core/air-continents`: seven continent codes/names, endpoint
  classification and track-index coverage summaries.
- `@motionstudies/data/air-endpoints`: retains the airport reference's continent
  and propagates it into observed endpoint objects, with optional documented overrides.
- `motionstudies-recorder`: writes those endpoint objects into the canonical index
  and playback chunks, retains override evidence, and reports coverage in the manifest.
- LUFT: future continent filters and summaries should read these fields through the
  shared core helper. Origin labels describe the departure airport; destination labels
  describe the arrival airport. At a focal airport, inbound traffic is grouped by the
  origin's continent and outbound traffic by the destination's continent.

## Current status

The shared classifier and recorder integration have been tested locally. They require
coordinated changes in the Motion Studies shared packages and recorder. No package
or aircraft-data release containing these labels has been published.

The committed LUFT `data-release.json` and published dataset remain unchanged.
Next adoption steps are a coordinated shared core/data package release, exact recorder
dependency upgrades, a new immutable air-day export, and an explicit LUFT package/data
pin update. Do not use sibling source imports or silently relabel a pinned release.

## Endpoint contract

Observed endpoints gain optional `continent` (`AF`, `AN`, `AS`, `EU`, `NA`, `OC`,
`SA`) and `continentSource` (`ourairports` or `override`) fields. Existing releases
remain readable. `classifyAirEndpoint` returns `known`, `unknown-endpoint` or
`unknown-continent`, with null continent for either unknown case. Never treat an
unknown as Europe or use aircraft heading to infer its destination.

The existing endpoint `icao` field stores the OurAirports reference `ident`, which
can differ from its current ICAO code. Preserve that join when interpreting this
release. Airport continent conventions come from the pinned reference and any
explicitly recorded overrides; EU means geographical Europe, not EU membership.

## Validation against the pinned day

[Integration evidence](evidence/continent-label-integration-2026-09-14.json) verifies
the pinned manifest, index and retained airport reference hashes, then labels existing
endpoints in memory using the updated shared parser and classifier. No source files
were rewritten.

For 14 September 2026, all 22,499 known origins and 22,000 known destinations resolve
to continent labels. The remaining 18,446 origin and 18,945 destination associations
are unobserved and remain unknown. Coverage is 54.95% and 53.73% of 40,945 canonical
track segments. These are not flight totals or deduplicated airport movements.
Zero observed endpoints in a continent does not establish absence of flights to it.
