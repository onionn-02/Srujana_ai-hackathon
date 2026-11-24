// Phase 0 logic check. Runs the test page in headless Chrome with stand-in Claude features
// (database, dictation, voice, AI, downloads) and replays the situations that broke before.
// It checks the page's own logic only; real mic, voice, AI and phone tests still need people.
// Usage: node tests/phase0/run.mjs        (set CHROME_PATH if Chrome is installed elsewhere)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "../../app/phase0/index.html"), "utf8");
const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

// Stand-ins for the Claude features. The database copies its rules: set replaces, update needs an existing record.
const fakes = `<script>
(() => {
  const store = window.__db = new Map(), subs = new Map(), busy = new Set();
  window.__overlap = 0;
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const snap = (path, pending) => ({ id: path.split("/").pop(), exists: store.has(path), data: () => clone(store.get(path)), metadata: { fromCache: false, hasPendingWrites: !!pending } });
  const colSnap = col => { const docs = [...store.keys()].filter(k => k.startsWith(col + "/") && !k.slice(col.length + 1).includes("/")).map(k => snap(k)); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } } };
  const emit = (path, pending) => {
    (subs.get(path) || []).forEach(f => f(snap(path, pending)));
    if (!pending) { const col = path.slice(0, path.lastIndexOf("/")); (subs.get("col:" + col) || []).forEach(f => f(colSnap(col))) }
  };
  const write = async (path, data, merge) => {
    if (busy.has(path)) window.__overlap++;
    if (merge && !store.has(path)) throw { code: "invalid_argument", message: "record does not exist" };
    busy.add(path);
    store.set(path, merge ? { ...store.get(path), ...clone(data) } : clone(data));
    emit(path, true);
    await new Promise(r => setTimeout(r, 30));
    busy.delete(path); emit(path, false);
  };
  const ref = path => ({ id: path.split("/").pop(), path, get: async () => snap(path), set: d => write(path, d, false), update: d => write(path, d, true),
    delete: async () => { store.delete(path); emit(path, false) },
    onSnapshot: f => { subs.set(path, [...(subs.get(path) || []), f]); setTimeout(() => f(snap(path)), 0); return () => {} } });
  const db = { doc: ref, collection: col => ({ path: col, doc: id => ref(col + "/" + id),
    onSnapshot: f => { subs.set("col:" + col, [...(subs.get("col:" + col) || []), f]); setTimeout(() => f(colSnap(col)), 0); return () => {} } }) };
  window.__external = (path, data) => { store.set(path, clone(data)); emit(path, false) };
  const h = { partial: [], final: [], state: [] };
  const dictation = {
    start: async () => { setTimeout(() => { h.state.forEach(f => f({ state: "starting" })); h.state.forEach(f => f({ state: "listening" })) }, 0) },
    stop: async () => h.state.forEach(f => f({ state: "idle", reason: "stopped" })), active: () => false,
    onPartial: f => (h.partial.push(f), () => {}), onFinal: f => (h.final.push(f), () => {}), onState: f => (h.state.push(f), () => {}) };
  window.__dict = { partial: t => h.partial.forEach(f => f({ text: t })), final: t => h.final.forEach(f => f({ text: t })), idle: r => h.state.forEach(f => f({ state: "idle", reason: r })) };
  const tts = { speak: async () => ({ playedMs: 2500 }), stop: async () => {}, onState: () => () => {} };
  const sample = async () => ({ text: "", truncated: false });
  sample.json = async (p, o) => o && o.images ? { item: "Femoral component", size: "6", other_text: null } : { kind: "event", summary: "drug given", event: { type: "drug", detail: "vancomycin 1 g" } };
  sample.limits = async () => ({ maxPromptBytes: 1e6, images: { maxCount: 4, maxInputBytes: 5e6, mediaTypes: ["image/jpeg", "image/png"] } });
  const downloads = { save: async () => ({ status: "saved" }) };
  window.claude = { use: async n => ({ db, dictation, tts, sample, downloads })[n] || null };
  // Saved earlier, as if the page had been used before this visit.
  store.set("phase0results/mic-laptop", { test: "mic", device: "laptop", auto: "Works", autoDetail: "earlier session", at: 1 });
  store.set("phase0sync/latest", { from: "phone", tab: "old", n: 3, at: Date.now() - 3600e3 });
})();
</script>`;

const checks = `<script>
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s), rec = id => window.__db.get("phase0results/" + id) || {};
  const R = [], check = (name, pass, info) => R.push({ name, pass: !!pass, info });
  const pill = t => $('[data-test="' + t + '"] [data-status]').textContent;
  try {
    await wait(300);
    check("A tap from before the page opened doesn't count as sync", pill("sync") === "Not tested" && /Earlier tap/.test($("#syncLive").textContent), $("#syncLive").textContent);

    $('[data-test="mic"] [data-v="Works"]').click(); await wait(300);
    check("A verdict click keeps the earlier automatic result", rec("mic-laptop").auto === "Works" && rec("mic-laptop").manual === "Works", JSON.stringify(rec("mic-laptop")));

    const vb = document.querySelectorAll('[data-test="voice"] [data-v]');
    for (let i = 0; i < 6; i++) vb[i % 2].click();
    await wait(800);
    check("Fast clicks never write one record twice at the same time", window.__overlap === 0, "overlapping writes: " + window.__overlap);
    check("The last verdict clicked is the one saved", rec("voice-laptop").manual === "Doesn't work", JSON.stringify(rec("voice-laptop")));

    window.__external("phase0sync/latest", { from: "phone", tab: "other", n: 1, at: Date.now() }); await wait(300);
    check("A new tap from the phone is received", pill("sync") === "Works" && /received from phone/.test(rec("sync-laptop").autoDetail || ""), JSON.stringify(rec("sync-laptop")));

    $("#syncTap").click(); await wait(400);
    check("This device's own tap is confirmed", /Saved and confirmed/.test($("#syncOut").textContent), $("#syncOut").textContent.split("\\n").pop());

    $("#micStart").click(); await wait(100);
    window.__dict.partial("tourni"); window.__dict.final("tourniquet on"); window.__dict.final("open the size five femoral"); await wait(50);
    window.__dict.idle("stopped"); await wait(300);
    const m = rec("mic-laptop");
    check("A listening session saves what was heard", m.auto === "Works" && (m.heard || []).length === 2 && m.manual === "Works", JSON.stringify(m));

    $("#micStart").click(); await wait(100); window.__dict.idle("time_limit"); await wait(300);
    check("An empty later session doesn't erase an earlier success", rec("mic-laptop").auto === "Works" && /time_limit/.test(rec("mic-laptop").autoDetail), JSON.stringify(rec("mic-laptop")));

    $("#aiRun").click(); await wait(300);
    check("The AI result is saved with its sentence", (rec("ai-laptop").tries || []).some(t => t.includes("vancomycin") && t.includes("event")), JSON.stringify(rec("ai-laptop")));

    $("#ttsRun").click(); await wait(300);
    check("The spoken answer saves the audio length and keeps the verdict", /2\\.5 s of audio/.test(rec("voice-laptop").autoDetail || "") && rec("voice-laptop").manual === "Doesn't work", JSON.stringify(rec("voice-laptop")));

    $("#saveTxt").click(); await wait(300);
    check("Saving only the text file shows the PDF as not tried", rec("save-laptop").auto === "Partly works" && /PDF not tried/.test(rec("save-laptop").autoDetail || ""), JSON.stringify(rec("save-laptop")));

    const c = document.createElement("canvas"); c.width = 40; c.height = 20; c.getContext("2d").fillRect(0, 0, 10, 10);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    const dt = new DataTransfer(); dt.items.add(new File([blob], "label.png", { type: "image/png" }));
    $("#photo").files = dt.files; $("#photo").dispatchEvent(new Event("change")); await wait(600);
    check("The label reading is saved", /Femoral component, size 6/.test(rec("photo-laptop").autoDetail || ""),
      JSON.stringify(rec("photo-laptop")) + " | status: " + pill("photo") + " | page said: " + $("#photoOut").textContent);

    check("The results table shows the automatic details", /event, /.test($("#sumbody").textContent), $("#sumbody").textContent.slice(0, 200));
  } catch (e) { check("The checks ran without a script error", false, String(e && e.stack || e)) }
  const pre = document.createElement("pre"); pre.id = "__results"; pre.textContent = JSON.stringify(R); document.body.append(pre);
})();
</script>`;

// Run Chrome in real time (image decoding needs it) and read the results through Chrome's debugging port.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dir = mkdtempSync(join(tmpdir(), "ot-phase0-"));
const file = join(dir, "harness.html");
writeFileSync(file, fakes + page + checks);
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`,
  `--user-data-dir=${join(dir, "profile")}`, pathToFileURL(file).href], { stdio: "ignore" });
let results;
try {
  const deadline = Date.now() + 60000;
  let wsUrl;
  while (!wsUrl && Date.now() < deadline) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page")?.webSocketDebuggerUrl } catch {}
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) throw new Error("Chrome did not start");
  const ws = new WebSocket(wsUrl), waiting = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id) } };
  let n = 0;
  const evaluate = expression => new Promise(res => { const id = ++n; waiting.set(id, res); ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true } })) });
  while (!results && Date.now() < deadline) {
    const text = (await evaluate(`(document.getElementById("__results") || {}).textContent || ""`)).result?.result?.value;
    if (text) results = JSON.parse(text); else await sleep(250);
  }
  ws.close();
} finally {
  proc.kill();
  await sleep(500);
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch {}
}
if (!results) { console.error("The checks did not finish within 60 seconds."); process.exit(1) }
let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "\n      " + r.info}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
