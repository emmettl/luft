# Chunk reuse — LUFT 0.2.2

The four-chunk limit applies to **decoded tracks in RAM**. Moving forward discards old decoded chunks to keep memory bounded. Previously, a loop or backward seek called fetch again, and the diagnostic labelled every successful response body as a download—even when the browser's HTTP cache supplied it.

LUFT now also keeps **verified compressed chunks in browser Cache Storage**. A loaded chunk is checked for byte length and SHA-256, decoded successfully, and then saved. Revisiting it reads and verifies the saved bytes without calling fetch. The cache survives page reloads when browser storage is available. Decoding still happens when a chunk re-enters the four-chunk RAM window.

- Only chunks actually visited or prefetched are saved; there is no upfront full-day download.
- The current recorded day totals **246.7 MiB** of compressed track chunks. The application cache has a **512 MiB** byte budget; oldest entries are evicted if necessary.
- Keys contain the chunk's expected hash. Cache initialization removes obsolete entries outside the current manifest from LUFT's dedicated cache only. Other apps' caches are untouched.
- Corrupt saved chunks are removed and fetched again. Failed or invalid responses are never saved.
- If storage is blocked, full or evicted by the browser, ordinary loading continues. This is a reusable data cache, not a promise of a fully offline website.
- Seeks still cancel unwanted requests and reject stale results. The decoded cache remains capped at four, including midnight prefetch.

Device details and Copy results distinguish:

| Measurement | Meaning |
| --- | --- |
| Chunks in memory | Decoded tracks available immediately, at most four |
| Track response data | Completed fetch response bytes this session; browser HTTP-cache hits may contribute, so this is not measured wire traffic |
| Reused from local storage / cache hits | Verified bytes read from LUFT's disk cache, with no fetch |
| Chunks saved on device | Compressed entries known to this page's cache index; browser eviction or another tab can change storage |

Response/reuse counters cover the page session. Reset measurements resets rendering timings, not these data counters. After the first full pass, a repeat loop should increase local-cache reuse rather than track response bytes, provided the browser retains the cache.

Tests check byte/hash verification, corrupt-entry repair, cache reuse across sessions, byte-budget eviction, obsolete-release cleanup, quota/security failures and cancellation. Chromium and WebKit tests seek away until the RAM chunks are evicted, revisit them, then reload; cached chunks produce no additional chunk requests.
