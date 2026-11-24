// Phase 6 checks for Operation notes in a real browser: the note beside its entries, the template draft (no AI),
// the marked sample operation, links from each fact to its entry, Edit and Save draft, Sign (second tap, final),
// Save PDF (a real PDF handed to claude.ai's file saving), the draft following the record, and layout, contrast
// and tap sizes on laptop and phone. Usage: node tests/phase6/run.mjs [--shots <folder>]
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openChrome, makeHarness, sleep } from "../lib/chrome.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "../../app");
const shotsAt = process.argv.indexOf("--shots");
const shotsDir = shotsAt > -1 ? process.argv[shotsAt + 1] : null;

const results = [];
const check = (name, pass, info = "") => results.push({ name, pass: !!pass, info });

const harness = makeHarness(appDir);
const chrome = await openChrome(harness.url);
const { send, evaluate, reload, navigate, errors } = chrome;
const go = async route => { await evaluate(`location.hash = "#${route}"`); await sleep(200) };
const waitFor = async (expr, ms = 4000) => { for (let t = 0; t < ms; t += 50) { if (await evaluate(expr).catch(() => false)) return true; await sleep(50) } return false };
const size = (w, h, mobile) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
const click = async (expr, wait = 200) => { await evaluate(`(${expr}).click()`); await sleep(wait) };
const btn = text => `[...document.querySelectorAll(".note-paper .btn, .note-paper button")].find(b => b.textContent.trim() === ${JSON.stringify(text)})`;
const shot = async (file, full) => {
  if (!shotsDir) return;
  let opts = { format: "png" };
  if (full) { const h = await evaluate("document.documentElement.scrollHeight"), w = await evaluate("innerWidth"); opts = { ...opts, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } } }
  writeFileSync(join(shotsDir, file), Buffer.from((await send("Page.captureScreenshot", opts)).data, "base64"));
};
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const READ = `(() => {
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)], txt = s => q(s)?.textContent.trim() || "";
  return {
    hash: location.hash, title: txt("#screen h1"), status: txt(".note-paper .panel-head .chip"), source: txt(".note-source"),
    sampleTag: !q(".notes-top .chip-caution")?.hidden, modes: qa(".notes-mode button").map(b => b.textContent + ":" + b.getAttribute("aria-pressed")),
    note: txt(".note-text"), sections: qa(".note-text h3").map(h => h.textContent), refs: qa(".note-text .ref").length,
    entries: qa(".note-entry").map(li => li.querySelector(".num").textContent + " " + li.querySelector("time").textContent + " " + li.querySelector(".note-entry-text").textContent),
    timelineEmpty: txt(".note-timeline .nurse-empty"), pending: txt(".note-paper .alert-medium"), signed: txt(".note-signed"),
    buttons: qa(".note-paper .note-actions .btn").map(b => b.textContent.trim() + (b.disabled ? ":disabled" : "")), error: txt(".note-error"), why: txt("#sign-why"),
  } })()`;

try {
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  await size(1280, 800, false);
  await navigate(harness.url + "#prep-c1");
  await waitFor(`!!document.querySelector(".prep-notes-link")`);
  await click(`document.querySelector(".prep-notes-link")`, 400);
  await waitFor(`!!document.querySelector(".note-paper .panel-head")`);
  let s = await evaluate(READ);
  check("Case prep's Open operation note opens Ravi's note", s.hash === "#notes-c1" && s.title === "Operation notes", JSON.stringify({ hash: s.hash, title: s.title }));
  check("Record view: says the draft is written by a template, not AI", s.status === "Draft from the record" && /template, not by AI.*AI draft comes in Phase 19/.test(s.source) && !s.sampleTag, JSON.stringify({ status: s.status, source: s.source }));
  check("Record view: header facts are there, and the empty record is said plainly", /Patient: Ravi Kumar, \d+, Male, Demo ID 1001/.test(s.note) && /Allergies: Penicillin \(anaphylaxis\)/.test(s.note) && /Nothing in the record yet/.test(s.note) && /No confirmed entries yet/.test(s.timelineEmpty), s.note.slice(0, 200));
  check("Record view: Sign is off until something is confirmed, and says why", s.buttons.includes("Sign note:disabled") && /Nothing to sign yet/.test(s.why), JSON.stringify({ buttons: s.buttons, why: s.why }));

  // The draft follows the record.
  await evaluate(`(async () => { const a = await OT.api.addEvent("c1", { type: "drug", text: "Vancomycin 1 g IV", source: "voice" }); await OT.api.addEvent("c1", { type: "step", text: "Time Out completed", source: "typed", by: "Circulating nurse" }); window.__wait = a.id })()`);
  await waitFor(`document.querySelectorAll(".note-entry").length === 1`);
  s = await evaluate(READ);
  check("A confirmed entry joins the draft by itself; a waiting one doesn't, and is counted", s.entries.length === 1 && /Time Out completed \[1\]|Time Out completed1/.test(s.note) && !/Vancomycin/.test(s.note) && /1 entry waits for the nurse/.test(s.pending), JSON.stringify({ entries: s.entries, pending: s.pending }));
  await evaluate(`OT.api.confirmEvent(window.__wait, { by: "Circulating nurse" })`);
  await waitFor(`document.querySelectorAll(".note-entry").length === 2`);
  s = await evaluate(READ);
  check("Once confirmed, it joins the note and the waiting notice goes", /Vancomycin 1 g IV/.test(s.note) && !s.pending && s.buttons.includes("Sign note"), JSON.stringify({ pending: s.pending, buttons: s.buttons }));

  // Sample operation, marked.
  await click(`document.querySelector('.notes-mode [data-mode="sample"]')`, 300);
  s = await evaluate(READ);
  check("Sample operation is marked on screen and in the switch", s.sampleTag && s.modes.join() === "Record:false,Sample operation:true", JSON.stringify({ tag: s.sampleTag, modes: s.modes }));
  check("Sample: 14 entries beside the note, numbered in time order", s.entries.length === 14 && s.entries[0] === "1 09:40 Vancomycin 1 g IV" && s.entries[13] === "14 11:58 Dressing applied", JSON.stringify(s.entries.slice(0, 2).concat(s.entries.slice(-1))));
  check("Sample: the note's sections, in order", s.sections.join("|") === "Details|Drugs given|Tourniquet|Steps|Implants|Differences from the plan|Counts|Complications", s.sections.join("|"));
  check("Sample: tourniquet time 73 minutes, the size 6 plan difference with its reason, no complications recorded", /Total tourniquet time: 73 minutes/.test(s.note) && /size 5 was planned\. Reason: Better fit at trial/.test(s.note) && /None recorded\./.test(s.note), s.note.slice(-600));
  check("Sample: every fact links to its entry (14 entries, plus on and off for the tourniquet total: 16 links)", s.refs === 16, `${s.refs} links`);
  await click(`[...document.querySelectorAll(".note-text .ref")].find(b => b.textContent === "11")`, 400);
  const flash = await evaluate(`({ n: document.querySelector(".note-entry.is-flash")?.dataset.n, focus: document.activeElement?.dataset?.n })`);
  check("Choosing a link highlights its entry and moves focus to it", flash.n === "11" && flash.focus === "11", JSON.stringify(flash));
  if (shotsDir) await shot("laptop-notes-sample.png", true);

  // Edit and save a draft.
  await click(btn("Edit"));
  const editing = await evaluate(`({ value: document.getElementById("note-text")?.value || "", focus: document.activeElement?.id })`);
  check("Edit opens the full note text, links kept as [n]", editing.focus === "note-text" && /^Details\n/.test(editing.value) && /\[5\]\[11\]/.test(editing.value), editing.value.slice(0, 80));
  await evaluate(`(() => { const t = document.getElementById("note-text"); t.value = t.value.replace("Closure", "Closure in layers") })()`);
  await click(btn("Save draft"), 400);
  s = await evaluate(READ);
  check("Saved draft shows the edit, who saved it, and its links still work", s.status === "Saved draft" && /Closure in layers/.test(s.note) && /^Saved by Dr\. Anil Rao at \d\d:\d\d\.$/.test(s.source) && s.refs === 16, JSON.stringify({ status: s.status, source: s.source, refs: s.refs }));

  // Sign: second tap, final.
  await click(btn("Sign note"));
  const ask = await evaluate(`({ text: document.querySelector(".note-sign")?.textContent || "", focus: document.activeElement?.textContent?.trim() })`);
  check("Sign asks for a second tap, as the surgeon", /Sign this note as Dr\. Anil Rao\? Signed notes can't be changed\./.test(ask.text) && ask.focus === "Sign note", JSON.stringify(ask));
  await click(btn("Not yet"));
  check("Not yet leaves the note unsigned", (await evaluate(READ)).status === "Saved draft");
  await click(btn("Sign note"));
  await click(`[...document.querySelectorAll(".note-sign .btn")].find(b => b.textContent.trim() === "Sign note")`, 400);
  s = await evaluate(READ);
  check("Signed: says who and when, and Edit and Sign are gone", s.status === "Signed" && /^Signed by Dr\. Anil Rao at \d\d:\d\d\. Signed notes can't be changed\.$/.test(s.signed) && s.buttons.join() === "Save PDF", JSON.stringify({ status: s.status, signed: s.signed, buttons: s.buttons }));

  // Save PDF, outside claude.ai (says so) and with claude.ai's file saving (a real PDF).
  await click(btn("Save PDF"), 400);
  s = await evaluate(READ);
  check("Outside claude.ai, Save PDF explains where it works", /Saving files works when the app is open in claude\.ai/.test(s.error), s.error);
  await evaluate(`window.claude = { use: async name => name === "downloads" ? { save: async req => { window.__saved = { filename: req.filename, type: req.data.type, size: req.data.size, head: await req.data.slice(0, 5).text(), body: await req.data.text() }; return { status: "saved" } } } : null }`);
  await click(btn("Save PDF"), 200);
  await waitFor(`!!window.__saved`, 15000);
  const saved = await evaluate(`window.__saved || null`);
  const today = await evaluate(`(() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") })()`);
  check("Save PDF hands a real PDF to claude.ai's file saving, named for the patient, date and sample", saved && saved.head === "%PDF-" && saved.type === "application/pdf" && saved.size > 2000 && saved.filename === `operation-note-1001-${today}-sample.pdf`, JSON.stringify(saved && { filename: saved.filename, head: saved.head, size: saved.size }));
  check("The PDF is marked as a sample, signed, and not for clinical use", saved && /SAMPLE OPERATION/.test(saved.body) && /Signed by Dr\. Anil Rao/.test(saved.body) && /Not for clinical use/.test(saved.body), "PDF text markers");
  check("Saving says so", /Saved operation-note-1001/.test(await evaluate(`document.getElementById("toast").textContent`)));

  // The sample note is separate: back to the record view, still unsigned.
  await click(`document.querySelector('.notes-mode [data-mode="record"]')`, 300);
  s = await evaluate(READ);
  check("The real note stays unsigned and apart from the sample note", s.status === "Draft from the record" && !s.sampleTag && s.entries.length === 2, JSON.stringify({ status: s.status, entries: s.entries.length }));

  // Picker and wrong link.
  await go("notes"); await waitFor(`document.querySelectorAll(".pick").length === 3`);
  check("Operation notes on its own lets you choose the operation", JSON.stringify(await evaluate(`[...document.querySelectorAll(".pick")].map(a => a.getAttribute("href"))`)) === JSON.stringify(["#notes-c1", "#notes-c2", "#notes-c3"]));
  await go("notes-c2"); await waitFor(`!!document.querySelector(".note-paper .panel-head")`);
  check("Arjun has no sample operation, so there's no switch", (await evaluate(READ)).modes.length === 0);
  await go("notes-zz9"); await waitFor(`!!document.querySelector(".notes-body [role=alert]")`);
  check("A wrong link says so and offers the list", /No operation with that ID.*Choose an operation/.test(await evaluate(`document.querySelector(".notes-body [role=alert]").textContent`)));

  // Layout, contrast and tap sizes.
  for (const [w, h, mobile, theme] of [[1280, 800, false, "light"], [1280, 800, false, "dark"], [375, 812, true, "light"], [375, 812, true, "dark"]]) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    await size(w, h, mobile);
    await go("today"); await go("notes-c1"); await waitFor(`!!document.querySelector(".note-paper .panel-head")`);
    await click(`document.querySelector('.notes-mode [data-mode="sample"]')`, 300);
    const tag = `${mobile ? "phone" : "laptop"} ${theme}`;
    const st = await evaluate("__qa.state()"), low = await evaluate("__qa.contrast()");
    check(`${tag}: no sideways scrolling and every icon exists`, st.overflow <= 0 && !st.missingIcons.length, JSON.stringify({ overflow: st.overflow, missing: st.missingIcons }));
    check(`${tag}: text contrast meets WCAG AA`, !low.length, low.slice(0, 6).join(" | "));
    if (mobile) { const small = await evaluate("__qa.touch()"); check(`${tag}: buttons big enough to tap`, !small.length, small.join(" | ")) }
    if (shotsDir && mobile && theme === "light") await shot("phone-notes-sample.png");
    if (shotsDir && !mobile && theme === "dark") await shot("laptop-notes-dark.png");
  }

  const errs = errors();
  check("No script errors or failed loads", !errs.length, errs.slice(0, 3).map(e => JSON.stringify(e.params).slice(0, 200)).join(" | "));
} catch (e) {
  check("The checks ran to the end", false, String(e && e.stack || e));
} finally {
  await chrome.close();
  harness.remove();
}

let failed = 0;
for (const r of results) { if (!r.pass) { failed++; console.log(`FAIL  ${r.name}\n      ${r.info}`) } }
console.log(`\n${results.length - failed}/${results.length} operation note checks passed${failed ? "" : " (all)"}`);
if (shotsDir) console.log(`Screenshots saved in ${shotsDir}`);
process.exit(failed ? 1 : 0);
