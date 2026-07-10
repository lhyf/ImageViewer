# ImageViewer

**English** · [简体中文](README.zh-CN.md)

A fast, lightweight image viewer for **Windows** and **macOS**.

ImageViewer pairs a single-image viewer with a folder-browsing library in one clean,
frameless window. It is built for quickly flipping through large, high-resolution
photos — zoom, pan, rotate, and full-screen with instant thumbnails — without the
bloat of an editing suite.

- **Two modes in one app** — a distraction-free viewer for a single picture, and a
  thumbnail library for browsing whole folders.
- **Made for big photos** — thumbnails and previews are generated with `sharp`,
  cached to disk, and produced under a concurrency cap so a folder of 40 MP camera
  shots stays smooth.
- **Native look on both platforms** — a custom frameless window with a light/dark
  theme, consistent across Windows and macOS.

---

## Features

### Library (browse) mode

- Folder tree on the left — quick-access shortcuts plus drives, expanded lazily.
- **Drag & drop** a photo — or a folder — onto the window to open it and jump
  straight into its folder.
- Breadcrumb path with back / forward / up / refresh navigation.
- Virtualized thumbnail grid (smooth with thousands of files); thumbnails are
  generated once and cached.
- Adjustable thumbnail size — the slider only re-lays-out, it never re-generates.
- Sort by name / date / size / type, ascending or descending.
- In-folder search and a status bar (name · dimensions · size · date · index).

### Viewer (single-image) mode

- Fit-to-window / 1:1 / zoom in / zoom out / full-screen.
- Mouse-wheel zoom centered on the cursor; drag to pan.
- Previous / next image, rotate left / right.
- Double-click toggles between **Fit** and **100%**.
- Floating info bar + toolbar and a filmstrip of thumbnails that auto-hide, and
  reappear on mouse move.
- Slideshow with auto-advance in full-screen; press any key to stop.

### Actions (right-click menu)

- Slideshow, copy image, save a copy (Save As…).
- Open containing folder, Open With…, set as desktop wallpaper, print.
- Rename, delete (to the Recycle Bin / Trash), and image info including EXIF.

### Supported formats

JPG · PNG · GIF · WebP · BMP · TIFF · AVIF · **HEIC/HEIF** · and **camera RAW**
(Canon CR3/CR2, Nikon NEF, Sony ARW, Fujifilm RAF, Adobe DNG, Olympus ORF,
Panasonic RW2, and more). RAW and HEIC are decoded to a full-resolution preview
for viewing — the app is a viewer, not a RAW editor.

---

## Keyboard shortcuts (viewer)

| Key | Action |
| --- | --- |
| `→` `↓` `PageDown` `Space` | Next image |
| `←` `↑` `PageUp` | Previous image |
| `+` / `=` | Zoom in |
| `-` / `_` | Zoom out |
| `0` | Fit to window |
| `1` | Actual size (100%) |
| `Delete` | Delete (to Recycle Bin / Trash) |
| `F11` | Toggle full-screen |
| `Esc` | Exit full-screen, or return to the library |
| Double-click | Toggle Fit ⇄ 100% |
| Mouse wheel | Zoom at cursor |

---

## Install

Download the latest installers from the [Releases page](https://github.com/lhyf/ImageViewer/releases).

**Windows** — run `ImageViewer-Setup-*.exe` (installer) or `ImageViewer-Portable-*.exe` (no install needed).

**macOS** — open the `.dmg` and drag **ImageViewer** into Applications. The app is
ad-hoc signed but not notarized (there is no paid Apple Developer ID), so on first
launch macOS may say *"ImageViewer is damaged and can't be opened."* That is
Gatekeeper blocking an un-notarized app, not actual corruption — clear the download
quarantine once in Terminal:

```bash
xattr -cr /Applications/ImageViewer.app
```

Then open it normally (it stays cleared afterwards).

---

## Tech stack

- **Electron** + **electron-vite** — cross-platform desktop shell and build tooling.
- **React 18** + **TypeScript** + **Tailwind CSS** — the renderer UI.
- **zustand** — application and UI state.
- **react-window** — virtualized thumbnail grid.
- **sharp** — thumbnail / preview generation and image dimensions (main process).
- **exifr** — EXIF metadata.

Local image files are served to the renderer through a custom, privileged `media://`
protocol rather than exposing the file system directly.

---

## Getting started

Requires **Node.js 18+**.

```bash
npm install
npm run dev        # start the dev environment with hot reload
npm run typecheck  # type-check the main + renderer projects
```

## Building installers

```bash
npm run dist:win   # Windows: NSIS installer + portable + zip  → release/
npm run dist:mac   # macOS:   dmg (x64 + arm64)  → must run on macOS
```

Artifacts are written to `release/`:

- `ImageViewer-Setup-<version>-x64.exe` — NSIS installer
- `ImageViewer-Portable-<version>-x64.exe` — single-file portable build
- `ImageViewer-<version>-x64.zip` — zipped app

The app icon is derived from `build/icon.png` (rendered from `build/icon.svg`);
electron-builder generates the platform `.ico` / `.icns` automatically.

> **Note — Windows packaging.** Signing and `rcedit` are disabled
> (`win.signAndEditExecutable: false`) so the build does not download the
> `winCodeSign` cache, which contains macOS symlinks that fail to extract on a
> Windows machine without Developer Mode / elevation. The trade-off is that the
> packaged `.exe` keeps the default Electron icon. To embed the custom icon
> instead, enable Windows **Developer Mode** (Settings → Privacy & security →
> For developers), re-enable signing in `electron-builder.yml`, and supply
> `build/icon.ico`.

---

## Project structure

```
src/
  main/            main process: window, media:// protocol,
                   file / thumbnail / EXIF / operation IPC
  preload/         contextBridge-exposed window.api
  renderer/        React UI
    components/    TitleBar · Browser · Viewer · context menu · dialogs
    store.ts       application state (zustand)
    useUI.ts       menu / dialog / toast / fullscreen state
  shared/types.ts  types shared across main / preload / renderer
build/             packaging resources (icon)
```

## License

MIT
