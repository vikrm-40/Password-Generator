import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { writeText as tauriWriteText } from '@tauri-apps/plugin-clipboard-manager';

declare global { interface Window { __TAURI_INTERNALS__?: unknown; } }

const SET_DEFS = [
  { key: "upper", label: "Uppercase", sample: "A–Z", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { key: "lower", label: "Lowercase", sample: "a–z", chars: "abcdefghijklmnopqrstuvwxyz" },
  { key: "digits", label: "Numbers", sample: "0–9", chars: "0123456789" },
  { key: "symbols", label: "Special", sample: "!@#$%&*", chars: "!@#$%^&*()-_=+[]{}|;:,.<>?" },
] as const;

type SetKey = (typeof SET_DEFS)[number]["key"];
type EnabledSets = Record<SetKey, boolean>;

const PASSWORD_LENGTHS = [8, 12, 16] as const;
const DEFAULT_LEN = 8;
const CLEAR_LENGTH = 8;
const TOTAL = 45;

function rInt(max: number) {
  const b = new Uint32Array(1);
  const lim = Math.floor(0x100000000 / max) * max;
  let v: number;
  do {
    crypto.getRandomValues(b);
    v = b[0];
  } while (v >= lim);
  return v % max;
}
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makePw(len: number, sets: string[]) {
  const all = sets.join("");
  const m = sets.map((s) => s[rInt(s.length)]);
  const r: string[] = [];
  for (let i = m.length; i < len; i++) r.push(all[rInt(all.length)]);
  return shuffle(m.concat(r)).join("");
}

const nativeClipboard = {
  async writeText(value: string): Promise<void> {
    if (window.__TAURI_INTERNALS__) {
      await tauriWriteText(value);
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      throw new Error('Clipboard API is unavailable');
    }
  },
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type LedState = "" | "green" | "amber" | "red";
type Tile = { ch: string; masked: boolean };

function Index() {
  const [pwLen, setPwLen] = useState(DEFAULT_LEN);
  const [enabled, setEnabled] = useState<EnabledSets>({
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
  });
  const [pw, setPw] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [tiles, setTiles] = useState<Tile[]>(() =>
    Array.from({ length: DEFAULT_LEN }, () => ({ ch: "·", masked: false })),
  );
  const [l1, setL1] = useState<LedState>("");
  const [l2, setL2] = useState<LedState>("");
  const [l3, setL3] = useState<LedState>("");
  const [banner, setBanner] = useState<{ type: "amber" | "red"; title: string; body: string } | null>(
    null,
  );
  const [clipLive, setClipLive] = useState(false);
  const [clipSec, setClipSec] = useState(0);
  const [clipCard, setClipCard] = useState<"live" | "safe" | null>(null);
  const [errorState, setErrorState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [strength, setStrength] = useState({ pct: 0, color: "#22cc66", label: "—" });
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);

  const clipTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safeCardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSets = SET_DEFS.filter((s) => enabled[s.key]).map((s) => s.chars);
  const activeCount = activeSets.length;

  // Refresh LED 3 / banner from state
  useEffect(() => {
    if (errorState) {
      setL3("red");
      setBanner({
        type: "red",
        title: "Security Error",
        body: "A clipboard operation failed. Please clear your clipboard manually.",
      });
    } else if (clipLive && revealed) {
      setL3("amber");
      setBanner({
        type: "amber",
        title: "Password Visible + Clipboard Hot",
        body: "Your password is both visible on screen AND still in the clipboard. Mask it and wipe when done.",
      });
    } else if (clipLive) {
      setL3("amber");
      setBanner({
        type: "amber",
        title: "Clipboard Hot",
        body: 'Your password is still in the clipboard. Click "Wipe Clipboard Now" after pasting.',
      });
    } else if (revealed) {
      setL3("amber");
      setBanner({
        type: "amber",
        title: "Password Visible",
        body: "Your password is unmasked on screen — shoulder surfing risk. Click Hide when done.",
      });
    } else {
      setL3("");
      setBanner(null);
    }
  }, [errorState, clipLive, revealed]);

  const renderBlankTiles = useCallback((n: number) => {
    setTiles(Array.from({ length: n }, () => ({ ch: "·", masked: false })));
  }, []);

  const msg = useCallback((text: string, color = "#228844", dur = 2500) => {
    setStatus({ text, color });
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => setStatus(null), dur);
  }, []);

  const stopTimer = useCallback(() => {
    if (clipTickRef.current) {
      clearInterval(clipTickRef.current);
      clipTickRef.current = null;
    }
    setClipLive(false);
    setClipSec(0);
  }, []);

  const onWipeSuccess = useCallback(() => {
    stopTimer();
    setErrorState(false);
    setClipCard("safe");
    if (safeCardTimeoutRef.current) clearTimeout(safeCardTimeoutRef.current);
    safeCardTimeoutRef.current = setTimeout(() => setClipCard(null), 4000);
    msg("✓ Clipboard wiped successfully!", "#228844", 3500);
  }, [msg, stopTimer]);

  const manualWipe = useCallback(async () => {
    try {
      await nativeClipboard.writeText('');
      onWipeSuccess();
    } catch {
      setErrorState(true);
      msg('Could not wipe — clear clipboard manually (Win + V)', '#ee3333', 5000);
    }
  }, [msg, onWipeSuccess]);

  const startTimer = useCallback(() => {
    stopTimer();
    setClipLive(true);
    setClipSec(TOTAL);
    setClipCard("live");
    let s = TOTAL;
    clipTickRef.current = setInterval(() => {
      s--;
      setClipSec(s);
      if (s <= 0) {
        if (clipTickRef.current) {
          clearInterval(clipTickRef.current);
          clipTickRef.current = null;
        }
      }
    }, 1000);
  }, [stopTimer]);

  const toggleReveal = () => {
    setRevealed((r) => {
      const nr = !r;
      setTiles((ts) => ts.map((t, i) => (pw ? { ch: pw[i], masked: !nr } : t)));
      return nr;
    });
  };

  const generate = async () => {
    if (!activeCount) {
      msg("Turn on at least one character set", "#cc6600");
      return;
    }
    setBusy(true);
    if (clipLive) manualWipe();
    stopTimer();
    setClipCard(null);
    setErrorState(false);
    setRevealed(false);
    setL1("amber");
    setL2("");
    setPw("");
    const n = pwLen;
    const sets = activeSets;
    setTiles(Array.from({ length: n }, () => ({ ch: "·", masked: false })));
    const p = makePw(n, sets);
    const spinChars = sets.join("");
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < 8; r++) {
        await sleep(32);
        const ch = spinChars[rInt(spinChars.length)];
        setTiles((ts) => {
          const next = ts.slice();
          next[i] = { ch, masked: false };
          return next;
        });
      }
      await sleep(32);
      setTiles((ts) => {
        const next = ts.slice();
        next[i] = { ch: p[i], masked: false };
        return next;
      });
    }
    await sleep(180);
    setPw(p);
    setTiles(Array.from({ length: n }, (_, i) => ({ ch: p[i], masked: true })));
    const rgx = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];
    const score = rgx.filter((rx) => rx.test(p)).length + (p.length >= 16 ? 1 : 0);
    const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
    const colors = ["#e04040", "#e08020", "#e0c020", "#80c020", "#22cc66"];
    const pcts = [0, 20, 40, 65, 85, 100];
    setStrength({
      pct: pcts[score],
      color: colors[Math.min(score - 1, 4)] ?? "#22cc66",
      label: labels[score] || "Good",
    });
    setL1("");
    setL2("green");
    setBusy(false);
  };

  const copyPw = async () => {
    if (!pw) {
      msg('Generate a password first', '#cc6600');
      return;
    }
    try {
      await nativeClipboard.writeText(pw);
      msg('✓ Copied! Paste it, then wipe.', '#228844', 3000);
      startTimer();
    } catch {
      setErrorState(true);
      msg('Copy failed — please check clipboard permissions', '#ee3333', 5000);
    }
  };

  const clearAll = () => {
    if (clipLive) manualWipe();
    setPwLen(CLEAR_LENGTH);
    setPw("");
    setRevealed(false);
    setErrorState(false);
    stopTimer();
    setClipCard(null);
    renderBlankTiles(CLEAR_LENGTH);
    setStrength({ pct: 0, color: "#22cc66", label: "—" });
    setL1("");
    setL2("");
  };

  const resetOutput = useCallback(
    (n: number) => {
      setPw("");
      setRevealed(false);
      stopTimer();
      setClipCard(null);
      setTiles(Array.from({ length: n }, () => ({ ch: "·", masked: false })));
      setStrength({ pct: 0, color: "#22cc66", label: "—" });
      setL1("");
      setL2("");
    },
    [stopTimer],
  );

  const setLen = (n: number) => {
    setPwLen(n);
    resetOutput(n);
  };

  const toggleSet = (key: SetKey) => {
    const onCount = Object.values(enabled).filter(Boolean).length;
    if (enabled[key] && onCount === 1) {
      msg("Keep at least one character set on", "#cc6600");
      return;
    }
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
    resetOutput(pwLen);
  };

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (clipTickRef.current) clearInterval(clipTickRef.current);
      if (safeCardTimeoutRef.current) clearTimeout(safeCardTimeoutRef.current);
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <main className="solari-page">
        <div className="layout">
        <div className="board">
          <div className="hdr">
            <h1 className="brand">Password Generator</h1>
            <div className="hright">
              <div className="leds">
                <div className={`led ${l1}`} title="LED 1 — Generating" />
                <div className={`led ${l2}`} title="LED 2 — Password Ready" />
                <div className={`led ${l3}`} title="LED 3 — Security Health" />
              </div>
            </div>
          </div>

          <h2 className="dlabel">Generated Password</h2>
          <div className="trow" style={{ "--n": tiles.length } as CSSProperties}>

            {tiles.map((t, i) => (
              <div key={i} className={`tile ${t.masked ? "masked" : ""}`}>
                <div className="th">
                  <span className="tc">{t.masked ? "●" : t.ch}</span>
                </div>
                <div className="tb">
                  <span className="tb2">{t.masked ? "●" : t.ch}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rrow">
            {pw && (
              <button className="rbtn" onClick={toggleReveal}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 4C5.5 4 2 10 2 10s3.5 6 8 6 8-6 8-6-3.5-6-8-6z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  {revealed && (
                    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  )}
                  {!revealed && (
                    <line
                      x1="4"
                      y1="16"
                      x2="16"
                      y2="4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                <span>{revealed ? "Hide" : "Reveal"}</span>
              </button>
            )}
          </div>

          {banner && (
            <div className={`sec-banner show ${banner.type === "red" ? "red-band" : "amber-band"}`}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L2 17h16L10 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="10" cy="14.5" r=".8" fill="currentColor" />
              </svg>
              <div className="sec-banner-txt">
                <div className="sec-banner-title">{banner.title}</div>
                <div>{banner.body}</div>
              </div>
            </div>
          )}

          {clipCard && (
            <div className={`clipcard show ${clipCard}`}>
              <div className="clipcard-header">
                <div className="clipcard-dot" />
                <div className="clipcard-title">
                  {clipCard === "live" ? "Password is in your clipboard" : "Clipboard wiped ✓"}
                </div>
              </div>
              <div className="clipcard-body">
                {clipCard === "live"
                  ? clipSec > 0
                    ? 'Go paste it now. Come back and click "Wipe Clipboard Now" once done.'
                    : '45 seconds have passed. Please click "Wipe Clipboard Now" to clear it.'
                  : "The active clipboard was overwritten. Windows clipboard history may still retain earlier entries."}
              </div>
              {clipCard === "live" && (
                <>
                  <div className="clipcard-timer">
                    <div className="clipcard-secs">{clipSec > 0 ? clipSec : "!"}</div>
                    <div className="clipcard-timer-right">
                      <div className="clipcard-timer-label">Seconds until reminder</div>
                      <div className="clipbar">
                        <div
                          className="clipfill"
                          style={{ width: `${Math.max(0, (clipSec / TOTAL) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <button className="wipebtn" onClick={manualWipe}>
                    🗑 Wipe Clipboard Now
                  </button>
                </>
              )}
            </div>
          )}

          <div className="ctrl">
            <div className="optcard">
              <div className="optrow">
                <span className="optlbl" id="length-label">
                  Length
                </span>
                <div className="len-options" role="group" aria-labelledby="length-label">
                  {PASSWORD_LENGTHS.map((length) => (
                    <button
                      key={length}
                      type="button"
                      className={`len-option ${pwLen === length ? "selected" : ""}`}
                      aria-pressed={pwLen === length}
                      onClick={() => setLen(length)}
                      disabled={busy}
                    >
                      {length}
                      <span>chars</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="chgrid" role="group" aria-label="Character sets to include">
                {SET_DEFS.map((s) => (
                  <label key={s.key} className={`chitem ${enabled[s.key] ? "on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={enabled[s.key]}
                      onChange={() => toggleSet(s.key)}
                      disabled={busy}
                    />
                    <span className="chbox" aria-hidden="true">
                      <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M4 10.5l4 4 8-9"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="chtxt">
                      <strong>{s.sample}</strong>
                      {s.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="strwrap">
              <div className="strlbl">Strength</div>
              <div className="strbar">
                <div
                  className="strfill"
                  style={{ width: `${strength.pct}%`, background: strength.color }}
                />
              </div>
              <div className="strval">{strength.label}</div>
            </div>
            <button className="gbtn" onClick={generate} disabled={busy || !activeCount}>
              ▶ Generate Password
            </button>
            <div className="arow">
              <button className="cpbtn" onClick={copyPw}>
                ⧉ Copy to Clipboard
              </button>
              <button className="clrbtn" onClick={clearAll} disabled={busy}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Clear
              </button>
            </div>
            <div className="strow">
              <div className={`stmsg ${status ? "show" : ""}`} style={{ color: status?.color }}>
                {status?.text}
              </div>
            </div>
          </div>
        </div>

        <aside className="side-card">
          <h2 className="secnote-title">Security &amp; Privacy</h2>
          <div className="secnote">
            No storage · No cookies · No network · Manual wipe button · crypto.getRandomValues()
          </div>

          <div className="led-key">
            <div className="lk"><div className="lk-dot a" /> LED 1 — Generating</div>
            <div className="lk"><div className="lk-dot g" /> LED 2 — Password Ready</div>
            <div className="lk"><div className="lk-dot a" /> LED 3 — Clipboard Hot / Revealed</div>
            <div className="lk"><div className="lk-dot r" /> LED 3 — Error</div>
            <div className="lk"><div className="lk-dot off" /> Off — Idle / Safe</div>
          </div>
          <div className="wnote">
            <svg className="wicon" width="15" height="15" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L2 17h16L10 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="10" cy="14.5" r=".8" fill="currentColor" />
            </svg>
            <div className="wtxt">
              <strong>Clipboard History Notice</strong>
              Note: If you have Clipboard History enabled (<span className="kbd">Win + V</span>), you may
              need to clear it manually. Use the “Wipe Clipboard Now” button after pasting your password.
            </div>
          </div>
        </aside>
        </div>
      </main>

    </>
  );
}

const CSS = `
.solari-page{background:#EFE7C8;background-image:linear-gradient(115deg,#F6EFD3 0%,#F6EFD3 46%,#1F6B4E 46%,#1F6B4E 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 16px;font-family:'Segoe UI',system-ui,sans-serif;color:#1B4635;}
.solari-page *{box-sizing:border-box;}
.layout{display:flex;gap:22px;align-items:stretch;width:100%;max-width:1060px;}
.board{background:rgba(255,255,255,.78);backdrop-filter:blur(14px);border-radius:34px;border:1px solid rgba(255,255,255,.7);padding:22px;flex:1 1 620px;min-width:0;max-width:680px;box-shadow:0 40px 90px -30px rgba(20,60,44,.45);display:flex;flex-direction:column;gap:14px;}
.side-card{background:rgba(255,255,255,.78);backdrop-filter:blur(14px);border-radius:34px;border:1px solid rgba(255,255,255,.7);padding:20px;flex:0 1 300px;min-width:270px;max-width:300px;box-shadow:0 24px 60px -30px rgba(20,60,44,.35);display:flex;flex-direction:column;gap:12px;justify-content:center;}
@media (max-width:900px){
  .layout{flex-direction:column;align-items:center;gap:18px;}
  .side-card{max-width:600px;width:100%;flex:none;}
}
.hdr{display:flex;align-items:center;justify-content:space-between;background:#FFFFFF;border-radius:26px;padding:18px 22px;box-shadow:0 12px 26px -16px rgba(20,60,44,.35);}
.brand{font-size:19px;margin:0;letter-spacing:-.02em;color:#1F6B4E;font-weight:800;line-height:1.15;max-width:70%;}
.hright{display:flex;align-items:center;gap:12px;}
.leds{display:flex;gap:7px;align-items:center;background:#F6EFD3;border-radius:999px;padding:8px 12px;}
.led{width:9px;height:9px;border-radius:50%;background:#DED6B4;transition:all .3s;}
.led.green{background:#1F6B4E;}
.led.amber{background:#E0A33C;}
.led.red{background:#C0503C;}
.dlabel{font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:.18em;color:#4B7A66;text-align:left;margin:2px 0 -4px 6px;font-weight:600;text-transform:uppercase;}
.secnote-title{font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:.18em;color:#4B7A66;text-align:center;margin:6px 0 0;font-weight:600;text-transform:uppercase;}
.trow{container-type:inline-size;display:flex;gap:5px;align-items:center;background:#FFFFFF;border-radius:26px;padding:18px 14px;min-height:78px;box-shadow:0 12px 26px -16px rgba(20,60,44,.35);overflow-x:auto;scrollbar-width:none;}
.trow::-webkit-scrollbar{display:none;}
.trow>.tile:first-child{margin-left:auto;}
.trow>.tile:last-child{margin-right:auto;}
.tile{--tw:max(13px,min(26px,calc((100cqw - (var(--n,12) - 1)*5px)/var(--n,12))));width:var(--tw);height:calc(var(--tw)*1.62);background:#1F6B4E;border-radius:calc(var(--tw)*.35);position:relative;overflow:hidden;flex-shrink:0;box-shadow:0 4px 10px -6px rgba(20,60,44,.6);}
.tile::after{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(0,0,0,.22);z-index:2;}
.th{position:absolute;top:0;left:0;right:0;height:50%;background:#26805D;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;border-radius:calc(var(--tw)*.35) calc(var(--tw)*.35) 0 0;}
.tb{position:absolute;bottom:0;left:0;right:0;height:50%;background:#1F6B4E;display:flex;align-items:flex-start;justify-content:center;overflow:hidden;border-radius:0 0 calc(var(--tw)*.35) calc(var(--tw)*.35);}
.tc{font-family:Consolas,'Courier New',monospace;font-size:calc(var(--tw)*.56);font-weight:600;color:#FBF7E4;line-height:1;transform:translateY(50%);display:block;}
.tb2{font-family:Consolas,'Courier New',monospace;font-size:calc(var(--tw)*.56);font-weight:600;color:#FBF7E4;line-height:1;transform:translateY(-50%);display:block;}
.tile.masked .tc,.tile.masked .tb2{color:#F0D89B;font-size:calc(var(--tw)*.48);}
.rrow{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-height:0;}
.rbtn{font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:.05em;color:#1F6B4E;background:#FFFFFF;border:none;border-radius:999px;padding:9px 16px;cursor:pointer;font-weight:600;transition:all .15s;outline:none;display:flex;align-items:center;gap:6px;box-shadow:0 8px 18px -12px rgba(20,60,44,.5);}
.rbtn:hover{background:#1F6B4E;color:#FBF7E4;}
.sec-banner{display:none;border-radius:22px;padding:14px 18px;font-size:12.5px;line-height:1.55;}
.sec-banner.show{display:flex;align-items:flex-start;gap:10px;}
.sec-banner.amber-band{background:#F6EFD3;color:#8A5E14;}
.sec-banner.red-band{background:#F8E3DE;color:#9A3A28;}
.sec-banner svg{flex-shrink:0;margin-top:2px;}
.sec-banner-txt{flex:1;}
.sec-banner-title{font-weight:700;font-size:12.5px;margin-bottom:2px;color:#1B4635;}
.clipcard{display:none;border-radius:26px;padding:18px;}
.clipcard.show{display:block;}
.clipcard.safe{background:#1F6B4E;color:#EDF6F1;}
.clipcard.live{background:#F6EFD3;}
.clipcard-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.clipcard-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.clipcard.safe .clipcard-dot{background:#F0D89B;}
.clipcard.live .clipcard-dot{background:#E0A33C;animation:solari-blink 1.4s infinite;}
@keyframes solari-blink{0%,100%{opacity:1}50%{opacity:.3}}
.clipcard-title{font-size:13.5px;font-weight:700;}
.clipcard.safe .clipcard-title{color:#FFFFFF;}
.clipcard.live .clipcard-title{color:#8A5E14;}
.clipcard-body{font-size:12.5px;line-height:1.6;color:#4B7A66;}
.clipcard.safe .clipcard-body{color:#D5E8DE;}
.clipcard-timer{display:flex;align-items:center;gap:14px;margin-top:12px;}
.clipcard-secs{font-family:Consolas,'Courier New',monospace;font-size:28px;font-weight:700;color:#1F6B4E;width:46px;flex-shrink:0;line-height:1;}
.clipcard-timer-right{flex:1;}
.clipcard-timer-label{font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#4B7A66;margin-bottom:6px;}
.clipbar{height:6px;background:#E4DBB8;border-radius:999px;overflow:hidden;}
.clipfill{height:100%;background:#1F6B4E;border-radius:999px;transition:width 1s linear;}
.wipebtn{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;color:#FBF7E4;background:#1F6B4E;border:none;border-radius:999px;padding:13px 18px;cursor:pointer;font-weight:700;transition:all .15s;outline:none;display:flex;align-items:center;gap:8px;margin-top:14px;width:100%;justify-content:center;}
.wipebtn:hover{background:#175540;}
.wipebtn:active{transform:scale(.98);}
.ctrl{display:flex;flex-direction:column;gap:12px;}
.optcard{background:#FFFFFF;border-radius:22px;padding:16px 20px;box-shadow:0 12px 26px -18px rgba(20,60,44,.35);display:flex;flex-direction:column;gap:14px;}
.optrow{display:flex;align-items:center;gap:14px;}
.optlbl{font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:.15em;color:#4B7A66;text-transform:uppercase;width:62px;flex-shrink:0;font-weight:600;}
.len-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex:1;min-width:0;}
.len-option{font-family:Consolas,'Courier New',monospace;font-size:14px;font-weight:700;color:#4B7A66;background:#F6EFD3;border:1.5px solid transparent;border-radius:12px;min-height:42px;padding:6px 8px;cursor:pointer;transition:background .15s,color .15s,border-color .15s;display:flex;align-items:center;justify-content:center;gap:5px;}
.len-option span{font-size:9px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;}
.len-option:hover{border-color:rgba(31,107,78,.35);}
.len-option.selected{background:#1F6B4E;color:#FBF7E4;}
.len-option:focus-visible{outline:2px solid #1F6B4E;outline-offset:3px;}
.chgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
.chitem{position:relative;display:flex;align-items:center;gap:10px;background:#F6EFD3;border-radius:14px;padding:10px 12px;cursor:pointer;transition:border-color .15s;user-select:none;border:1.5px solid transparent;}
.chitem:hover{border-color:rgba(31,107,78,.35);}
.chitem input{position:absolute;opacity:0;pointer-events:none;}
.chbox{width:18px;height:18px;border-radius:6px;background:#FFFFFF;border:1.5px solid #DED6B4;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;color:transparent;}
.chitem.on .chbox{background:#1F6B4E;border-color:#1F6B4E;color:#FBF7E4;}
.chitem input:focus-visible ~ .chbox{outline:2px solid #1F6B4E;outline-offset:2px;}
.chtxt{font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#4B7A66;line-height:1.3;}
.chtxt strong{display:block;font-family:Consolas,'Courier New',monospace;font-size:11px;color:#1B4635;font-weight:700;}
.strwrap{display:flex;align-items:center;gap:14px;background:#FFFFFF;border-radius:22px;padding:16px 20px;box-shadow:0 12px 26px -18px rgba(20,60,44,.35);}
.strlbl{font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:.15em;color:#4B7A66;text-transform:uppercase;width:62px;flex-shrink:0;font-weight:600;}
.strbar{flex:1;height:7px;background:#E9E1BF;border-radius:999px;overflow:hidden;}
.strfill{height:100%;width:0%;background:#1F6B4E;transition:width .5s,background .5s;border-radius:999px;}
.strval{font-family:Consolas,'Courier New',monospace;font-size:11px;color:#1F6B4E;width:82px;text-align:right;flex-shrink:0;font-weight:700;}
.gbtn{font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;color:#FBF7E4;background:#1F6B4E;border:none;border-radius:999px;padding:18px 0;cursor:pointer;width:100%;font-weight:700;transition:all .15s;outline:none;box-shadow:0 18px 34px -18px rgba(20,60,44,.75);}
.gbtn:hover{background:#175540;}
.gbtn:active{transform:scale(.99);}
.gbtn:disabled{opacity:.5;cursor:not-allowed;}
.arow{display:flex;gap:10px;}
.cpbtn{font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;color:#31527E;background:#AEC3DE;border:none;border-radius:999px;padding:15px 0;cursor:pointer;font-weight:700;transition:all .15s;outline:none;flex:1;}
.cpbtn:hover{background:#9BB5D6;}
.clrbtn{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;color:#4B7A66;background:#FFFFFF;border:none;border-radius:999px;padding:15px 20px;cursor:pointer;font-weight:600;transition:all .15s;outline:none;display:flex;align-items:center;gap:7px;}
.clrbtn:hover{background:#F6EFD3;color:#1F6B4E;}
.strow{display:flex;align-items:center;justify-content:center;min-height:18px;}
.stmsg{font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:.03em;opacity:0;transition:opacity .3s;}
.stmsg.show{opacity:1;}
.secnote{font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:.05em;color:#4B7A66;text-align:center;line-height:1.8;padding:8px 4px;}
.led-key{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;padding:4px;}
.lk{display:flex;align-items:center;gap:6px;font-family:Consolas,'Courier New',monospace;font-size:10px;color:#4B7A66;}
.lk-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.lk-dot.g{background:#1F6B4E;}
.lk-dot.a{background:#E0A33C;}
.lk-dot.r{background:#C0503C;}
.lk-dot.off{background:#DED6B4;}
.wnote{display:flex;align-items:flex-start;gap:12px;background:#F6EFD3;border-radius:22px;padding:16px 18px;}
.wicon{flex-shrink:0;margin-top:2px;color:#B98527;}
.wtxt{font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;line-height:1.65;color:#4B7A66;}
.wtxt strong{font-weight:700;display:block;font-size:13px;margin-bottom:3px;color:#1B4635;}
.kbd{display:inline-block;font-family:Consolas,'Courier New',monospace;font-size:10px;font-weight:600;background:#FFFFFF;border-radius:6px;padding:2px 6px;color:#1F6B4E;}
@media (max-width:640px){
  .solari-page{padding:20px 12px 28px;background-image:linear-gradient(160deg,#F6EFD3 0%,#F6EFD3 42%,#1F6B4E 42%,#1F6B4E 100%);align-items:flex-start;}
  .board{border-radius:26px;padding:14px;gap:12px;}
  .hdr{border-radius:20px;padding:14px 16px;gap:10px;}
  .brand{font-size:16px;max-width:100%;}
  .trow{border-radius:20px;padding:14px 8px;min-height:66px;gap:clamp(2px,0.8vw,5px);}
  .strwrap{border-radius:18px;padding:14px 16px;gap:10px;}
  .optcard{border-radius:18px;padding:14px 16px;gap:12px;}
  .optrow{gap:10px;}
  .optlbl{width:auto;}
  .gbtn{font-size:15px;padding:16px 0;}
  .arow{flex-wrap:wrap;}
  .cpbtn{flex:1 1 100%;}
  .clrbtn{flex:1 1 100%;justify-content:center;}
  .clipcard,.sec-banner,.wnote{border-radius:18px;padding:14px;}
  .clipcard-secs{font-size:24px;width:38px;}
  .led-key{gap:8px 12px;}
  .secnote{word-break:break-word;}
}
@media (max-width:400px){
  .hdr{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;}
  .brand{font-size:15px;}
  .optrow{flex-wrap:wrap;}
  .strwrap{flex-wrap:wrap;}
  .strbar{flex:1 1 100%;order:3;}
}

.solari-page button:focus-visible{outline:3px solid #245eac;outline-offset:3px;}
@media (prefers-reduced-motion:reduce){.solari-page *, .solari-page *::before,.solari-page *::after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
`;

export default Index;
