// Drives a headless Chrome through its debugging port, using only what ships with Node and Chrome,
// plus shared page checks (contrast, tap sizes, layout) that every phase's browser test uses.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// claude.ai wraps the page in this skeleton when it publishes it, so the checks do the same.
export function makeHarness(appDir) {
  const file = join(appDir, `.test-${process.pid}-${Date.now()}.html`);
  writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${readFileSync(join(appDir, "index.html"), "utf8")}</body></html>`);
  return { url: pathToFileURL(file).href, remove: () => rmSync(file, { force: true }) };
}

export async function openChrome(url) {
  const dir = mkdtempSync(join(tmpdir(), "ot-chrome-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
    `--remote-debugging-port=${port}`, `--user-data-dir=${join(dir, "profile")}`, url], { stdio: "ignore" });
  const deadline = Date.now() + 30000;
  let wsUrl;
  while (!wsUrl && Date.now() < deadline) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page")?.webSocketDebuggerUrl } catch {}
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) { proc.kill(); throw new Error("Chrome did not start") }

  const ws = new WebSocket(wsUrl), waiting = new Map(), events = [];
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id) } else if (m.method) events.push(m);
  };
  let n = 0;
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++n;
    waiting.set(id, m => m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const key = async (key, code, keyCode, text) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, ...(text ? { text } : {}) });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
  };
  const close = async () => {
    try { ws.close() } catch {}
    proc.kill();
    await sleep(500);
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch {}
  };
  // Load or reload, then wait for the page, its fonts and the first screen heading, and add the page checks.
  const ready = async () => {
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      if (await evaluate(`document.readyState === "complete" && document.fonts.status === "loaded" && !!document.querySelector("#screen h1")`).catch(() => false)) break;
    }
    await evaluate(QA_SCRIPT);
  };
  const reload = async () => { await send("Page.reload", { ignoreCache: true }); await ready() };
  const navigate = async target => { await send("Page.navigate", { url: target }); await ready() };
  const errors = () => events.filter(e => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") || (e.method === "Log.entryAdded" && e.params.entry.level === "error"));
  return { send, evaluate, key, events, errors, reload, navigate, close };
}

// Page checks, added to the page as window.__qa.
export const QA_SCRIPT = `window.__qa = {
  visible(el) { if (!el.getClientRects().length) return false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false } return true },
  parse(c) {
    let m = c.match(/^rgba?\\(([^)]+)\\)/); if (m) { const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
    m = c.match(/^color\\(srgb ([^)]+)\\)/); if (m) { const p = m[1].split(/[\\s\\/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 } }
    return null },
  lum(c) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) },
  over(t, b) { return { r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 } },
  contrast() {
    const fails = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("svg, template, script, style, .vh, [disabled]")) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || !this.visible(el)) continue;
      let opacity = 1; const layers = [];
      for (let e = el; e; e = e.parentElement) {
        const s = getComputedStyle(e), c = this.parse(s.backgroundColor);
        if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break }
        opacity *= Number(s.opacity);
      }
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = layers.length - 1; i >= 0; i--) bg = this.over(layers[i], bg);
      const s = getComputedStyle(el), fg0 = this.parse(s.color); if (!fg0) continue;
      const fg = this.over({ ...fg0, a: fg0.a * opacity }, bg);
      const L1 = this.lum(fg), L2 = this.lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(s.fontSize), large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) fails.push(ratio.toFixed(2) + ' "' + el.textContent.trim().slice(0, 40) + '"');
    }
    return fails },
  touch() {
    const fails = [];
    for (const el of document.querySelectorAll(".btn, .nav a, .check, .segmented button, select, input:not([type=checkbox])")) {
      if (!this.visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 43.5 || r.width < 43.5) fails.push(Math.round(r.width) + "x" + Math.round(r.height) + " " + (el.textContent.trim().slice(0, 30) || el.tagName));
    }
    return fails },
  state() {
    const shown = s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 };
    return { title: document.querySelector("#screen h1")?.textContent.trim(), current: document.querySelector('#nav a[aria-current="page"]')?.dataset.route || null,
      chrome: document.getElementById("shell").dataset.chrome, menu: document.getElementById("shell").dataset.menu,
      rail: shown("#rail"), floatBtn: shown(".float-menu"), topbar: shown(".topbar"),
      topbarHeight: Math.round(document.querySelector(".topbar").getBoundingClientRect().height),
      overflow: document.documentElement.scrollWidth - innerWidth,
      missingIcons: [...document.querySelectorAll("use")].map(u => u.getAttribute("href")).filter(h => !document.querySelector(h)),
      focus: document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName };
  },
};`;
