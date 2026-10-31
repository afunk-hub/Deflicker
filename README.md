# Prairie Preludes Time-Lapse Deflicker — Version 1.0.00

A GitHub Pages-hosted, local-first browser app for reducing exposure flicker in time-lapse videos. Designed for Android Chrome and other modern browsers.

## Features

- Select a local video and preview the original clip.
- Process locally in the browser using FFmpeg WebAssembly; the selected video is not uploaded to a server.
- Choose **Gentle**, **Balanced**, or **Strong** exposure-deflicker settings.
- Optionally apply experimental temporal color smoothing (may cause motion ghosting).
- Keep audio when present, choose export quality, monitor progress, preview the result, and download an MP4.
- No server, account, API key, or app-side 200 MB file cap.

## Important limitations

**Files up to 500 MB are a target, not a guarantee on every Android phone.** Browser-based FFmpeg keeps working data in device memory and may need several times the input file size. Large videos can cause the browser to run out of memory or close the tab. A desktop FFmpeg workflow is more reliable for very large files.

The main `deflicker` filter reduces temporal frame-luminance variation and may help with exposure flicker and some perceived color pumping. It is not a full white-balance correction system. The optional `tmix` color-smoothing option is experimental and can ghost moving objects. Review the result before keeping it.

The first processing run requires an internet connection to load FFmpeg WebAssembly from the unpkg CDN. Your video stays on your device; only the processing code is fetched from the CDN. Offline use is not guaranteed.

## Create the GitHub repository and deploy

1. Download and extract this ZIP.
2. Create a **new, empty GitHub repository** for this app, such as `prairie-preludes-deflicker`.
3. Upload the **contents of the `prairie-preludes-deflicker` folder** to the repository root. The root should contain `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, and the `assets` folder. Do not upload only the ZIP file or leave all the files nested in an extra folder.
4. Open the repository's **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**, select your default branch (usually `main`) and the `/(root)` folder, then save.
6. Wait for the deployment to complete, then open the Pages URL shown by GitHub.
7. In Android Chrome, open the app URL and use Chrome's menu to choose **Install app** or **Add to Home screen** if available.

### Important: keep the app identity separate

This app's manifest has a dedicated `id` (`./?app=prairie-preludes-deflicker`) and a scope/start URL relative to its own repository path. Keep it deployed at its own repository URL, such as `https://YOUR-USERNAME.github.io/prairie-preludes-deflicker/`. Do not deploy it at the root `https://YOUR-USERNAME.github.io/` if another app already uses that root URL. Separate repositories under one GitHub Pages username can share the same origin but have different paths; that alone should not prevent installation.

If Chrome reports that the app is already installed, first confirm that the correct repository URL is open and that the deployed `manifest.webmanifest` contains the ID above. Check Chrome's installed-app list for an older installation with a similar name before clearing site data.

## Local testing

Serve the directory over HTTP rather than opening `index.html` as a file, because the app uses JavaScript modules. For example, with Python installed:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Privacy

- Source video is read by the browser and processed in local browser memory.
- No analytics, user accounts, or application server are included.
- FFmpeg code is loaded from unpkg on first use; the video itself is not sent to unpkg.
- Preview and download use temporary browser object URLs.

## License

MIT. See `LICENSE`.
