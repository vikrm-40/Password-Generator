# Password Generator — Tauri Windows Edition v2.1.0

This desktop edition uses the supplied Lovable Solari React interface, adapted into a static, offline Vite/React frontend bundled with Tauri. It does **not** require Lovable hosting or a web server at runtime.

## Requirements
Node.js, npm, Rust MSVC toolchain, Windows C++ Build Tools, WebView2, and Windows 11.

## Build and test

```cmd
npm install
npm run build:web
npm run tauri dev
npm run tauri build
```

Test the **installed release**, not just development mode, before Store submission. The corrected MSIX must be generated and validated separately as done for v2.0.2.

## Features
- Exactly 8, 12, 16 character presets (default 8)
- Clear resets to 8 characters and blanks the display
- No password-length slider
- Lovable split-flap UI and right-hand help panel, without the strong-password guide link
- Local crypto.getRandomValues generation
- Windows native clipboard integration through Tauri; manual wipe is not guaranteed to erase Windows Clipboard History
- Offline frontend; no external font imports or web API dependency

## Source and security
The included original Lovable project is not used as a live backend. Only the offline React screen and its styles were ported; its server/router code and external metadata aren't included. See the supplied Lovable ZIP for the reference source. Preserve your existing v2.0.2 Store package until release testing is complete.
