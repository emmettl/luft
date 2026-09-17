# Daily recorded aircraft refresh

LUFT attempts to publish the **previous complete UTC day at 06:23 UTC**. A second run at **12:23 UTC** retries delayed sources, failed validation or deployment. GitHub schedules can start later than their nominal time. The header shows the recorded date; this remains recorded playback, not live traffic.

Workflow: [Refresh daily aircraft feed](https://github.com/emmettl/luft/actions/workflows/daily-feed.yml).

## Pipeline

1. Select yesterday in UTC. Refuse today, future dates and rollback to an older date. An already-pinned day skips capture but still builds/deploys, allowing recovery from a failed deployment.
2. Check out the exact private recorder commit in `daily-feed.json`. `RECORDER_READ_KEY` is a dedicated **read-only deploy key** on `motionstudies-recorder`; the job uses LUFT's short-lived `GITHUB_TOKEN` for LUFT releases and commits. No personal access token or live recording host is used.
3. Download 48 ADSB.lol half-hour inputs. The shared capture command bounds each response at 64 MiB, total source bytes at 3 GiB, and retries each request once. Offline compilation verifies all 8,640 expected ten-second frames and 144 playback chunks. A 12 GiB free-space floor and per-partition memory/time limits remain enforced.
4. Reuse the retained airport and land references from the hash-pinned bootstrap archive. Fetch the pinned VRS standing-data revision and verify every route file against its configured hash. Run the shared enrichment exporter without old manual reviews: observed endpoints and optional route candidates are rebuilt for this day; no previous day's corroboration is transferred. VRS references are intentionally pinned, not a live schedule service.
5. Verify the candidate archive, sidecar, report hashes and identity bindings. Rebuild country membership, geography, airline summaries, snapshots and route paths. Run the production build, unit/integrity checks, and desktop Chromium / phone-sized WebKit tests against the candidate.
6. Publish the immutable `air-YYYY-MM-DD-v1` release with playback, enrichment and both lock files. Verify that its public archive can be downloaded with the expected hash. Only then commit the pins and country/enrichment assets to `main`, upload the built site and deploy GitHub Pages.

The daily and ordinary Pages workflows share a concurrency group. A concurrent change to `main` makes publication stop rather than overwrite work. Ordinary Pages builds check out current `main`, preventing an older queued build from restoring stale data. Bot commits do not trigger a second push workflow; the daily workflow explicitly performs deployment.

## Failure and recovery

The previous deployment stays live until a successful Pages deployment replaces it. Failed capture or checks cannot advance the data pins. A failure after publication can leave a validated dated release ahead of the live site; the next attempt reuses and verifies that exact release. Incomplete unpublished draft uploads can be rebuilt; published assets are never overwritten. If pins advanced but deployment failed, the next run redeploys the pinned day.

Use **Run workflow** with no date to retry yesterday. Supply a completed UTC date to advance deliberately to that date. Check both `refresh` and `deploy` jobs: the run is successful only when deployment is successful. GitHub Actions supplies run failures, logs, job summaries and seven-day browser artifacts; account notification preferences control failure emails. No external email, messaging or monitoring account is configured.

Source inputs and compiler scratch data live only on the ephemeral GitHub runner and disappear after the job. Dated public releases remain available for provenance and rollback; at roughly 260 MB per day, retained releases grow over time. There is no automatic deletion of public archives. The job has a 120-minute limit. A missing source day leaves the displayed date unchanged; a later run targets the latest previous day rather than backfilling every missed date.

Open tabs check for a newer recorded date every five minutes and on focus. **Refresh** opens the new day while retaining URL filters. A tab is never silently switched midway through playback. A much older tab may need refreshing when uncached files from its old deployment are no longer available.

## Reference updates and local validation

`daily-feed.json` pins the compiler commit, bootstrap reference archive and VRS commit/file hashes. Update these intentionally with a candidate validation; geography downloads are also pinned in `scripts/build-countries.mjs`. Daily traffic does not require new references or an edit to the browser engine.

To prepare an isolated candidate (Node 24+, with the pinned recorder checkout and its `npm ci` dependencies):

```sh
node scripts/daily/prepare.mjs --date YYYY-MM-DD \
  --recorder /path/to/pinned-recorder --work /tmp/new-luft-day
```

Preparation refuses a work directory inside either source checkout. It never adopts or publishes data. In a **disposable LUFT checkout** with dependencies installed:

```sh
node scripts/daily/adopt.mjs --candidate /tmp/new-luft-day/candidate
npm run build
npm test
npm run test:browser
```

Adoption replaces the disposable checkout's generated data, enrichment and pins only after verifying incoming bytes. Publication is a separate CI step. Normal `data:fetch` continues to refuse a mismatched existing local data directory; when deliberately switching a developer checkout to a newer pin, remove its generated `public/data/` directory before fetching again.

For an intentional rollback, revert the **whole daily commit** (both descriptors, country asset, enrichment directory and freshness marker) and run the ordinary Pages workflow. Disable the daily workflow first if the older day must remain selected.
