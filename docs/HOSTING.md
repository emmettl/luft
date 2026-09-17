# Dual publishing

LUFT is published at https://motionstudies.app/luft/ and
https://emmettl.github.io/luft/. Cloudflare serves a byte-identical copy of each
successful Pages artifact with its own Workers Static Assets deployment,
`luft-hosting`, on `motionstudies.app/luft*`. The slashless URL redirects to
`/luft/`, preserving query parameters. Missing files return 404.

`.github/workflows/cloudflare.yml` follows successful main-branch runs of
`Check and deploy LUFT` and `Refresh daily aircraft feed`. It uses the shared
Motion Studies publisher pinned to a reviewed commit. Builds, tests and Pages
publication finish before Cloudflare publication begins; a Cloudflare failure
does not undo the available Pages release. Superseded releases are skipped.

The `cloudflare` environment allows main only and stores `CLOUDFLARE_API_TOKEN`
as an encrypted secret. The token needs Workers Scripts edit on the hosting
account and Workers Routes edit plus Zone read for `motionstudies.app`. Never
store plaintext credentials or a local Wrangler OAuth token in this repository.
`CLOUDFLARE_ENABLED=true` enables automatic publication; set it to `false` to pause.

To retry, dispatch `Publish to Cloudflare` with the successful source run ID.
`https://motionstudies.app/luft/_release.json` identifies the source repository,
run and commit, plus artifact file count, byte count and content digest.
The publisher checks that metadata and live cache headers after every deploy.

Hashed application assets are immutable for one year. HTML and recorded datasets
revalidate; release metadata uses `no-cache`. All playback and enrichment files
are bundled static assets, with no new live service or R2 reads. The catalogue's
existing automatic Cloudflare Web Analytics injection applies to the domain.

For rollback, pause automatic publishing and redeploy a prior successful Pages
artifact with the shared publisher, omitting `--require-latest`, or select an
earlier `luft-hosting` deployment in Cloudflare. Re-enable publishing when ready.
