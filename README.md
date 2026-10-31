# Prairie Preludes Time-Lapse Deflicker

A GitHub Pages-hosted, local-first browser app for reducing exposure flicker in time-lapse videos. Built for Android Chrome and other modern browsers.

## What it does

- Loads a local video and previews it in the browser.
- Uses FFmpeg WebAssembly locally to run FFmpeg's `deflicker` filter.
- Offers Gentle / Balanced / Strong filter window presets.
- Optionally applies a mild temporal blend to reduce some visible color changes. This is experimental and can create ghosting, especially around moving clouds, animals, or tree branches.
- Exports an MP4 file for local download.
- Does not upload the selected footage to a server.

## Important limitations

**A 500 MB file is a target, not a guarantee on every Android phone.** The app does not have a server upload limit, but FFmpeg WebAssembly loads the input and output into browser-managed memory. It can require substantially more memory than the input file size. Some phones may run out of memory or the browser may close the tab. For very large files, a desktop FFmpeg workflow is more reliable.

The app's main correction is FFmpeg's `deflicker` filter, designed to reduce temporal frame-luminance variations. It can help with brightness pumping and some perceived exposure-related color changes, but it is not a full white-balance reconstruction system. The optional `tmix` setting smooths adjacent frames and may introduce motion ghosting. Inspect the result before using it.

The first launch requires an internet connection to load FFmpeg WebAssembly from the unpkg CDN. After that, browser caching may help, but offline operation is not guaranteed. The app never uploads your video; the CDN only serves the app's processing code.

## Deploy to GitHub Pages

1. Create a new GitHub repository, for example `prairie-preludes-deflicker`.
2. Upload the contents of this folder to the repository root (not the enclosing ZIP folder).
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your default branch (usually `main`) and the `/(root)` folder, then save.
6. Wait for deployment. GitHub will show the public Pages URL in Settings → Pages.
7. Open that URL in Chrome on Android. Choose **Add to Home screen** from Chrome's menu if you want an app-like shortcut.

No backend, API key, database, or secrets are required.

## Local testing

Because `app.js` uses ES modules, serve the directory over HTTP instead of opening `index.html` directly. For example, if Python is installed:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Privacy

- Source footage is read by the browser and passed to the local FFmpeg WebAssembly engine.
- No analytics, accounts, or app server are included.
- The app downloads the FFmpeg engine from unpkg on first use. Your selected video is not sent to unpkg.
- The app creates local browser object URLs for preview/download. These are revoked when starting over.

## License

MIT. See `LICENSE`.

## PWA identity note

This build sets a unique web-app manifest `id` (`./?app=prairie-preludes-deflicker`) so Chrome can distinguish this app from other Prairie Preludes apps hosted in separate repository paths under the same `username.github.io` origin. Keep the repository's own GitHub Pages path as the deployment path; do not publish this app at the root if another app already uses that root URL.

If Chrome still reports that the app is installed, open Chrome's app-management area and check whether an older installation is listed under another name, then reload the deployed site and try again. The shared GitHub Pages domain alone should not prevent separate apps from being installed.
