> **v2.0.2 release correction:** Before building an installer, run `npm run build:web` and confirm the `PASS` message. See `RELEASE-BUILD-FIX.md`.

# Password Generator — Windows Desktop Edition

A Tauri v2 Windows desktop port of the user's existing standalone Password Generator. Includes the existing Solari-style UI and password features, bundled locally with no dependency on GitHub Pages at runtime.

**Start here:** [WINDOWS-BUILD-GUIDE.md](WINDOWS-BUILD-GUIDE.md).

This is a separate experimental Windows application source tree. It is **not** a replacement Microsoft Store package. Keep your currently published PWA intact until this version is tested and a Store migration path is confirmed.

#  This desktop edition works offline and includes the commands npm install, npm run tauri dev, and npm run tauri build.