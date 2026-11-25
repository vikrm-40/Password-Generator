/* ════════════════════════════════════════════
     Password Generator — v2.0.0  (Windows Desktop Edition)
     Security:
       · crypto.getRandomValues()
       · Password masked by default
       · Reveal / Hide toggle
       · Manual clipboard wipe + 45s countdown
       · LED 1 Generating · LED 2 Ready · LED 3 Security health
       · No localStorage · No sessionStorage · No cookies · No network
     Desktop:
       · Locally bundled assets, no service worker
       · Windows clipboard via Tauri clipboard-manager plugin
  ════════════════════════════════════════════ */

  /* Desktop edition bundles its web assets locally; no PWA service worker. */

  /* ── Handle URL params for shortcuts (?len=12 or ?len=16) ── */

  /* ════════ App logic ════════ */

  var pwLen     = 12;
  var generating = false;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pw        = '';
  var revealed  = false;
  var clipLive  = false;
  var errorState= false;
  var clipTick  = null;
  var clipSec   = 0;
  var TOTAL     = 45;

  var CS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?'.split('');

  /* ── Crypto ── */
  function rInt(max) {
    if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw new RangeError('Invalid random range');
    var b = new Uint32Array(1), range = 0x100000000;
    var lim = Math.floor(range / max) * max;
    do { crypto.getRandomValues(b); } while (b[0] >= lim);
    return b[0] % max;
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  var charSets = {
    optLower: 'abcdefghijklmnopqrstuvwxyz',
    optUpper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    optNumbers: '0123456789',
    optSymbols: '!@#$%^&*()-_=+[]{}|;:,.<>?'
  };
  function chosenSets() {
    return Object.keys(charSets).filter(function(id) { return document.getElementById(id).checked; }).map(function(id) { return charSets[id]; });
  }
  function makePw(len) {
    var sets = chosenSets();
    if (!sets.length) throw new Error('Choose at least one character type');
    var all = sets.join('');
    var chars = sets.map(function(set) { return set[rInt(set.length)]; });
    for (var i = chars.length; i < len; i++) chars.push(all[rInt(all.length)]);
    return shuffle(chars).join('');
  }
  function resetGenerated() {
    pw = ''; revealed = false;
    if (!clipLive) { stopTimer(); hideClipCard(); }
    renderTiles(pwLen);
    document.getElementById('copybtn').disabled = true;
    document.getElementById('rbtn').style.display = 'none';
    document.getElementById('rbtn').setAttribute('aria-pressed','false');
    document.getElementById('rlbl').textContent = 'Reveal';
    document.getElementById('stk').style.display = 'block';
    document.getElementById('pup').style.display = 'inline';
    document.getElementById('strfill').style.width = '0%';
    document.getElementById('strval').textContent = '—';
    document.getElementById('strbar').setAttribute('aria-valuenow','0');
    led('l1',''); led('l2',''); refreshLed3();
  }
  function updateOptions() {
    if (generating) return;
    if (!chosenSets().length) {
      // Do not silently choose a different character class on the user's behalf.
      document.getElementById('gbtn').disabled = true;
      document.getElementById('optionHelp').textContent = 'Select at least one character type to generate a password.';
    } else {
      document.getElementById('gbtn').disabled = false;
      document.getElementById('optionHelp').textContent = 'At least one character type must remain selected.';
    }
    resetGenerated();
  }
  function updateStrength(password) {
    // Approximate entropy under independently sampled characters; selection guarantees
    // one per enabled class and therefore the exact entropy is slightly different.
    var poolSize = chosenSets().join('').length;
    var bits = password.length * Math.log2(poolSize);
    var label = bits < 50 ? 'Fair' : bits < 80 ? 'Good' : bits < 110 ? 'Strong' : 'Very strong';
    var percent = Math.min(100, Math.max(15, bits / 128 * 100));
    document.getElementById('strfill').style.width = percent + '%';
    document.getElementById('strval').textContent = label;
    document.getElementById('strbar').setAttribute('aria-valuenow', String(Math.round(percent)));
    document.getElementById('strbar').setAttribute('aria-valuetext', label + ', estimated ' + Math.round(bits) + ' bits');
  }

  /* ── LEDs ── */
  function led(id, state) { document.getElementById(id).className = 'led' + (state ? ' '+state : ''); }

  function refreshLed3() {
    if (errorState) {
      led('l3','red');
      showBanner('red','Security Error','A clipboard operation failed. Please clear your clipboard manually.');
    } else if (clipLive && revealed) {
      led('l3','amber');
      showBanner('amber','Password Visible + Clipboard Hot','Your password is both visible on screen AND still in the clipboard. Mask it and wipe when done.');
    } else if (clipLive) {
      led('l3','amber');
      showBanner('amber','Clipboard Hot','Your password is still in the clipboard. Click "Wipe Clipboard Now" after pasting.');
    } else if (revealed) {
      led('l3','amber');
      showBanner('amber','Password Visible','Your password is unmasked on screen — shoulder surfing risk. Click Hide when done.');
    } else {
      led('l3','');
      hideBanner();
    }
  }

  function showBanner(type, title, body) {
    var b = document.getElementById('secbanner');
    b.className = 'sec-banner show ' + (type === 'red' ? 'red-band' : 'amber-band');
    document.getElementById('bannertitle').textContent = title;
    document.getElementById('bannerbody').textContent  = body;
  }
  function hideBanner() { document.getElementById('secbanner').classList.remove('show'); }

  /* ── Tiles ── */
  function renderTiles(n) {
    var row = document.getElementById('trow'); row.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var d = document.createElement('div');
      d.className = 'tile'; d.id = 't'+i;
      d.innerHTML = '<div class="th"><span class="tc">·</span></div><div class="tb"><span class="tb2">·</span></div>';
      row.appendChild(d);
    }
  }
  function setTile(i, c, mask) {
    var d = document.getElementById('t'+i); if (!d) return;
    var ch = mask ? '●' : c;
    d.className = 'tile' + (mask ? ' masked' : '');
    d.querySelector('.tc').textContent  = ch;
    d.querySelector('.tb2').textContent = ch;
  }
  function maskAll(mask) { if (pw) for (var i = 0; i < pw.length; i++) setTile(i, pw[i], mask); }

  /* ── Reveal ── */
  function toggleReveal() {
    if (!pw || generating) return;
    revealed = !revealed; maskAll(!revealed);
    document.getElementById('rbtn').setAttribute('aria-pressed',String(revealed));
    document.getElementById('trow').setAttribute('aria-label',revealed ? 'Password visible on screen' : 'Password hidden until revealed');
    document.getElementById('rlbl').textContent  = revealed ? 'Hide'   : 'Reveal';
    document.getElementById('stk').style.display = revealed ? 'none'   : 'block';
    document.getElementById('pup').style.display = revealed ? 'inline' : 'none';
    refreshLed3();
  }

  /* ── Status msg ── */
  function msg(txt, col, dur) {
    var e = document.getElementById('stmsg');
    e.textContent = txt; e.style.color = col || '#228844';
    e.classList.add('show');
    setTimeout(function() { e.classList.remove('show'); }, dur || 2500);
  }

  /* ── Clipboard card ── */
  function showClipCard(state) {
    var card  = document.getElementById('clipcard');
    var title = document.getElementById('clipcardtitle');
    var body  = document.getElementById('clipcardbody');
    var timer = document.getElementById('clipcardtimer');
    var wbtn  = document.getElementById('wipebtn');
    card.className = 'clipcard show ' + state;
    if (state === 'live') {
      title.textContent   = 'Password is in your clipboard';
      body.textContent    = 'Go paste it now. Come back and click "Wipe Clipboard Now" once done.';
      timer.style.display = 'flex'; wbtn.style.display = 'flex';
    } else {
      title.textContent   = 'Clipboard wiped ✓';
      body.textContent    = 'The current clipboard contents were cleared. Windows clipboard history may still retain earlier entries.';
      timer.style.display = 'none'; wbtn.style.display = 'none';
      setTimeout(function() { card.classList.remove('show'); }, 4000);
    }
  }
  function hideClipCard() { document.getElementById('clipcard').classList.remove('show'); }

  /* ── Timer ── */
  function stopTimer() {
    if (clipTick) { clearInterval(clipTick); clipTick = null; }
    clipSec = 0;
  }
  function startTimer() {
    stopTimer(); clipLive = true; clipSec = TOTAL;
    showClipCard('live'); updateTimerDisplay(); refreshLed3();
    clipTick = setInterval(function() {
      clipSec--;
      if (clipSec <= 0) {
        if (clipTick) { clearInterval(clipTick); clipTick = null; }
        document.getElementById('clipsecs').textContent = '!';
        document.getElementById('clipfill').style.width = '0%';
        document.getElementById('clipcardbody').textContent = '45 seconds have passed. Please click "Wipe Clipboard Now" to clear it.';
        refreshLed3();
      } else { updateTimerDisplay(); }
    }, 1000);
  }
  function updateTimerDisplay() {
    document.getElementById('clipsecs').textContent    = clipSec;
    document.getElementById('clipfill').style.width = ((clipSec / TOTAL) * 100) + '%';
  }

  /* Native clipboard in Windows desktop edition; browser fallback for UI previews. */
  function desktopClipboard() {
    return window.__TAURI__ && window.__TAURI__.clipboardManager;
  }
  function writeClipboard(text) {
    var native = desktopClipboard();
    return native ? native.writeText(text) : navigator.clipboard.writeText(text);
  }
  function readClipboard() {
    var native = desktopClipboard();
    return native ? native.readText() : navigator.clipboard.readText();
  }
  var lastCopiedPassword = null;

  /* ── Wipe ── */
  async function manualWipe() {
    // Do not overwrite unrelated clipboard content if it has changed since Copy.
    try {
      var contents = await readClipboard();
      if (lastCopiedPassword !== null && contents !== lastCopiedPassword) {
        clipLive = false; lastCopiedPassword = null; stopTimer(); hideClipCard();
        refreshLed3();
        msg('Clipboard has changed; other content was preserved.', '#206a50', 4500);
        return;
      }
      await writeClipboard('');
      onWipeSuccess();
    } catch(e) {
      // Native failures should be reported rather than using legacy browser hacks.
      if (desktopClipboard()) {
        errorState = true; refreshLed3();
        msg('Clipboard unavailable. Clear it manually (Win + V).', '#c34d41', 5000);
      } else { legacyWipe(); }
    }
  }
  function legacyWipe() {
    try {
      var ta = document.createElement('textarea');
      ta.value = ''; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;width:1px;height:1px;';
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand('copy'); document.body.removeChild(ta);
      if (!ok) throw new Error('Clipboard command failed');
      onWipeSuccess();
    } catch(e) {
      errorState = true; refreshLed3();
      msg('Could not wipe — please clear clipboard manually', '#ee3333', 5000);
    }
  }
  function onWipeSuccess() {
    stopTimer(); clipLive = false; errorState = false; lastCopiedPassword = null;
    showClipCard('safe'); refreshLed3();
    msg('✓ Clipboard wiped successfully!', '#228844', 3500);
  }

  /* ── Generate ── */
  var sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

  async function generate() {
    if (generating) return;
    if (!chosenSets().length) { msg('Select at least one character type','#c34d41',4000); return; }
    generating = true;
    var btn = document.getElementById('gbtn');
    btn.disabled = true;
    try {
      if (!clipLive) { stopTimer(); hideClipCard(); }
      errorState = false; revealed = false;
      document.getElementById('rbtn').style.display = 'none';
      document.getElementById('rlbl').textContent = 'Reveal';
      document.getElementById('stk').style.display = 'block';
      document.getElementById('pup').style.display = 'inline';
      led('l1','amber'); led('l2',''); refreshLed3();
      pw = ''; renderTiles(pwLen);
      var p = makePw(pwLen);
      for (var i = 0; i < pwLen; i++) {
        if (!reducedMotion) { setTile(i, CS[rInt(CS.length)], false); await sleep(14); }
        setTile(i, p[i], false);
      }
      pw = p; maskAll(true);
      document.getElementById('trow').setAttribute('aria-label','Password hidden until revealed');
      document.getElementById('rbtn').style.display = 'flex';
      document.getElementById('copybtn').disabled = false;
      updateStrength(p);
      led('l1',''); led('l2','green'); refreshLed3();
    } catch(e) {
      console.error('Password generation failed:', e);
      pw = ''; renderTiles(pwLen);
      document.getElementById('copybtn').disabled = true;
      errorState = true;
      refreshLed3();
      msg('Generation failed. See developer console for details.','#c34d41',6000);
    } finally {
      generating = false;
      btn.disabled = !chosenSets().length;
    }
  }

  /* ── Copy ── */
  async function copyPw() {
    if (generating || !pw) { msg('Generate a password first','#cc6600'); return; }
    try { await writeClipboard(pw); }
    catch(e) {
      if (desktopClipboard()) { errorState = true; refreshLed3(); msg('Copy failed — check Windows clipboard permissions','#c34d41',5000); return; }
      var ta = document.createElement('textarea');
      ta.value = pw; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); document.body.removeChild(ta);
      if (!ok) { errorState = true; refreshLed3(); msg('Copy failed — use a secure browser context','#c34d41',5000); return; }
    }
    lastCopiedPassword = pw;
    msg('✓ Copied! Paste it, then wipe.','#228844',3000);
    startTimer();
  }

  /* ── Clear ── */
  function clearAll() {
    if (generating) return;
    errorState = false;
    resetGenerated();
    msg(clipLive ? 'Screen cleared. Clipboard still needs wiping.' : 'Password cleared from screen.', '#206a50');
  }

  /* ── Set length ── */
  function setLen(n) {
    if (generating || !Number.isInteger(n) || n < 8 || n > 64) return;
    pwLen = n;
    document.getElementById('b12').setAttribute('aria-pressed', String(n === 12));
    document.getElementById('b16').setAttribute('aria-pressed', String(n === 16));
    document.getElementById('b12').className = 'sbtn' + (n===12?' on':'');
    document.getElementById('b16').className = 'sbtn' + (n===16?' on':'');
    document.getElementById('customLength').value = String(n);
    document.getElementById('lengthValue').textContent = String(n);
    resetGenerated();
  }

  /* ── Explicit event handlers: compatible with Tauri's strict CSP. ── */
  document.getElementById('rbtn').addEventListener('click', toggleReveal);
  document.getElementById('wipebtn').addEventListener('click', manualWipe);
  document.getElementById('b12').addEventListener('click', function() { setLen(12); });
  document.getElementById('b16').addEventListener('click', function() { setLen(16); });
  document.getElementById('customLength').addEventListener('input', function(e) { setLen(Number(e.target.value)); });
  Object.keys(charSets).forEach(function(id) {
    document.getElementById(id).addEventListener('change', updateOptions);
  });
  document.getElementById('gbtn').addEventListener('click', generate);
  document.getElementById('copybtn').addEventListener('click', copyPw);
  document.getElementById('clearbtn').addEventListener('click', clearAll);

  /* ── Init ── */
  renderTiles(pwLen);
  updateOptions();
  var params = new URLSearchParams(window.location.search);
  var initialLen = parseInt(params.get('len'), 10);
  if (Number.isInteger(initialLen) && initialLen >= 8 && initialLen <= 64) setLen(initialLen);
