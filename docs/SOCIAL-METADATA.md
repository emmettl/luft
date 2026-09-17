# Social preview and page metadata

The canonical production URL is `https://motionstudies.app/luft/`.

`index.html` includes the canonical production URL, description, Open Graph and
Twitter large-image cards, image dimensions and alt text, icons, crawler metadata,
and WebSite structured data. These are static so link-preview crawlers do not need
to execute the app. The single canonical page is listed in `public/sitemap.xml`;
filter hashes and renderer query strings share that page's metadata.

`public/og-image.png` is a checked-in 1200 × 630 PNG composed from the actual
Canvas map at 12:00 UTC in the locally pinned recorded day. It includes aircraft
data attribution. The PNG icons use the existing SVG favicon. Vite copies these
assets into the deployment without requiring a browser during the build.

To refresh the images after a visual redesign, prepare the pinned data and start
the app with `npm run dev`, then run:

```sh
npx playwright install chromium
node scripts/build-social-assets.mjs http://127.0.0.1:5173/luft/
```

Review the resulting PNG before committing it. If the production URL changes,
update the canonical, Open Graph, Twitter and structured-data URLs in
`index.html`, along with `public/sitemap.xml`.

Motion Studies and the GitHub Pages mirror serve this project at `/luft/`.
Both builds point to the Motion Studies canonical URL. Crawler rules in a project-level
`/luft/robots.txt` would not govern the site, so crawler preferences live in the
page's robots meta tag. No installable PWA or offline support is claimed.
