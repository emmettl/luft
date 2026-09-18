# Possible holding experiment

The 2026-09-16 dataset supports a useful visual experiment, but does not contain labelled holding events. These are geometric candidates, not confirmed holds; the score is not a calibrated probability.

## Findings

The audit scanned all 144 verified chunks, joining each track across chunk boundaries and using only the samples owned by each chunk. Source manifest: `498c3650180192032e13970c2787576f296dd5fdbf03adf38d651bdc7afd21d0`.

| Stage | Distinct tracks |
| --- | ---: |
| Recorded | 40,519 |
| Observed destination present in the airport catalogue | 20,819 |
| Enough valid history for at least one evaluated window | 36,586 |
| Low destination progress plus altitude/proximity context | 4,224 |
| Loop geometry plus altitude/proximity, without progress check | 503 |
| All checks | 499 |

There were 9,449,053 overlapping window evaluations, not independent observations. The 499 candidate tracks include 238 with observed destination Heathrow, 87 Dublin, and 44 Gatwick. A track is counted once even if multiple windows qualify; these numbers are not counts of individual holds.

Progress is a useful screening signal but adds little independent evidence after loop closure: removing it changes 499 candidates to 503. This is expected mathematically: the absolute change in distance to any destination cannot exceed the displacement between a window's start and end. A tightly closed loop therefore already guarantees low progress.

Visual spot checks in the [gallery](evidence/holding/index.html) show racetrack-like motion in BAW315, RYR96SR and BTX3C, while low-progress rejected examples include clear open approach turns (DHK52H, SXS3DZ, EZY23YD). Some high scores are compact circuits or irregular repeated turns (SRD224E, YRCAA, BURRO63). Their purpose cannot be established from these data. No precision or recall claim is possible without independently labelled examples. These examples were selected for inspection, not randomly sampled validation.

## Method

Evaluate trailing 4, 6 and 8 minute windows approximately every 30 study seconds; require at least 210 seconds and 15 km of observed travel. Reset history at gaps over 45 seconds, reject invalid/non-increasing samples and implausible position jumps. Ignore segments under 150 m when calculating headings to reduce positional jitter.

A candidate requires all of:

- Absolute destination progress / path length below 0.20, including travel away from the destination.
- Start-to-end displacement / path length below 0.22.
- At least 300 degrees of net turning; absolute net turn / total absolute turn at least 0.80.
- A mapped observed destination within 150 km at the window end.
- All altitudes between 1,500 and 22,000 feet, with a range at most 2,500 feet. These are recorded altitude values, not height above local terrain.

The best eligible window supplies the score. Stronger repetition, tighter closure and closer destination give more emphasis. Track geometry uses past samples only; the destination is the retrospectively observed endpoint of the recorded flight, so this is not a prospective live detector. Flights without mapped observed destinations receive no emphasis; schedule-based endpoint guesses are not used.

The thresholds are prototype choices, not fitted or validated operational limits. Sensitivity, keeping all other checks fixed:

| Maximum absolute progress ratio | ≥300° turn | ≥360° turn | ≥540° turn |
| --- | ---: | ---: | ---: |
| 0.10 | 418 | 293 | 120 |
| 0.20 | 499 | 332 | 137 |
| 0.30 | 503 | 333 | 137 |

A stricter repeat-turn requirement substantially reduces coverage. Missing observations, longer holds, high-altitude holds, significant descent and missing destinations can all cause misses. Training circuits and other intentional loitering can still qualify.

## Second-day check before release

The unchanged heuristic was also run across all 144 verified chunks for September 17. Of 42,198 recorded tracks, 21,077 have mapped observed destinations; 4,532 pass low-progress/context checks and 545 pass all checks. Geometry/context without progress selects 547. This is an independent recorded day, but still has no holding labels and therefore does not establish accuracy. The [second-day summary](evidence/holding/2026-09-17-summary.json) records its provenance and threshold sensitivity. The gallery above remains the original September 16 experiment.

## Playback and reproduction

Watch mode gently increases trail width, pale colour and tail visibility with the score, preserving the existing three-minute trail and head sizes. Normal viewing remains unchanged. Selected flights and filter dimming take priority. Scores blend over 30 study seconds after evidence arrives, expire when stale, and are deterministic when seeking backwards. The extra GPU state is uploaded only in Watch mode; retained trail geometry is not rebuilt as scores change.

`npm run data:holding` regenerates the compact playback index, machine-readable audit and standalone gallery. Normal data preparation regenerates the index without rewriting the checked-in report. Source hashes and chunk window ownership are verified before processing; the runtime also checks that the index belongs to the recorded release. All geometric analysis happens during data preparation, not on the playback thread.

The full [audit JSON](evidence/holding/audit.json) contains the strongest window for each candidate and 24 deterministic low-progress controls, including samples for independent inspection. Synthetic tests cover loops, gradual descent, tangential flight, ordinary turns, gaps, teleports, absent destinations, invalid values, score fades and backward seeks. Browser checks verify GPU pixels brighten and restore without rebuilding geometry, alongside Canvas/GPU Watch behaviour in Chromium and WebKit.
