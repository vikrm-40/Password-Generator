# Password Generator — Refined UI + Custom Password Settings

This build is based on the user's uploaded source package, preserving the Solari split-flap theme and green/cream screenshot design.

## UI and functionality

- Responsive two-panel design on desktop and single-column layout on mobile.
- Forest-green and cream palette, soft cards, clear primary and secondary buttons.
- Original one-click 12- and 16-character choices, plus optional 8–64-character slider.
- Optional lowercase, uppercase, number, symbol checkboxes. Selecting none disables generation until a choice is made.
- Secure random output with `crypto.getRandomValues()` and rejection sampling to avoid modulo bias. The generator includes at least one character from each selected category and shuffles the result.
- Reveal/Hide, Copy, Generate, and Clear, with visible focus indicators and reduced-motion support.
- Approximate strength indication based on length and enabled character pool. This is a heuristic, not an exact entropy calculation or password audit.
- Clipboard wipe is **manual**. The 45-second countdown is a reminder only; clearing the current clipboard does not guarantee clearing Windows clipboard history.
- Relative manifest/service-worker URLs for hosting from both GitHub Pages subpaths and custom domain roots; bumped offline cache version.

## Windows local testing

1. Extract ZIP and open Command Prompt in the application folder (the folder containing `index.html`).
2. Run `python -m http.server 8000`.
3. Visit `http://localhost:8000/` in Edge or Chrome.
4. Try 12 / 16 / slider 8 / slider 64, each character category, and the empty-selection disabled state.
5. Test Generate, Reveal/Hide, Copy, Wipe Clipboard, Clear, narrow-screen responsiveness, and keyboard-only navigation.
6. Inspect PWA offline installation on HTTPS (local service workers work with localhost).

## Deploying to GitHub and Cloudflare

Copy all changed application files to your existing repository directory (replace `index.html`, `manifest.json`, `sw.js`; keep `icons/`). Use GitHub Desktop to review, commit and push. Cloudflare/Pages should publish the updated files after the configured deployment triggers. Reload the deployed app; if an installed PWA continues to show old UI, close and reopen it, or clear that site's cached data.

## Privacy notes

- The application does not save generated passwords to persistent browser storage.
- Clipboard writes may require a secure context and browser permission.
- If Windows Clipboard History is enabled, users must manage it separately (`Win + V`).
- Offline support caches only app shell files, never generated passwords.
