# Local testing: fresh interface

This version updates `sw.js` from cache v4 to v5 and uses **network-first HTML navigation** so the browser loads the newest `index.html` whenever the local server is available. Static assets remain cached for offline access.

1. Extract this ZIP and open a terminal in the folder containing `index.html`.
2. Run `python -m http.server 8000` (or `py -m http.server 8000`).
3. Open `http://localhost:8000/` in Edge and press **Ctrl+Shift+R**.
4. Click **Customize password** to expand the optional 8–64-character slider and character category switches.

If you still see the previous version, go to Edge DevTools **F12 → Application → Service workers → Unregister** for `localhost:8000`, and **Application → Storage → Clear site data**. Then reload. Note that clearing site data affects other apps you may have served using this same `localhost:8000` origin.

Do not test a second unrelated project on the same port with an existing PWA service worker registered for `/` without unregistering it first.
