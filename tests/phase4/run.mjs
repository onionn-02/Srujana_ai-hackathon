// Phase 4 checks for the theatre display in a real browser: opening it from Case prep, the live view
// (patient, allergy, warning, steps, timers not started, live record updating by itself), the clearly marked
// sample moment, other patients, the picker, clean-up when leaving, readability at TV and laptop sizes
// (big enough text, everything on one screen), and contrast in both views.
// Usage: node tests/phase4/run.mjs [--shots <folder>]
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
const go = async route => { await evaluate(`location.hash = "#${route}"`); await sleep(150) };
const waitFor = async (expr, ms = 3000) => { for (let t = 0; t < ms; t += 50) { if (await evaluate(expr).catch(() => false)) return true; await sleep(50) } return false };
const size = async (w, h, mobile = false) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
const shot = async file => { if (!shotsDir) return; const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(shotsDir, file), Buffer.from(r.data, "base64")) };
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const READ = `(() => {
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)], txt = s => q(s)?.textContent.trim() || "";
  return {
    hash: location.hash, h1: txt("#screen h1"), h1Hidden: q("#screen h1")?.classList.contains("vh"), chrome: q("#shell").dataset.chrome,
    name: txt(".wall-name"), facts: txt(".wall-facts"), side: txt(".wall .side"), proc: q(".wall-proc")?.lastChild?.textContent || "", theatre: txt(".wall-theatre"),
    preop: txt(".wall-where .chip"), sampleTag: !q(".wall-where .chip-caution")?.hidden, clock: txt(".wall-clock"),
    allergyClass: q(".wall-allergy")?.className || "", allergy: txt(".wall-allergy"),
    warnings: q(".wall-warnings")?.hidden ? [] : qa(".wall-warnings .alert").map(a => a.textContent.trim()),
    steps: qa(".wall-steps li").map(li => li.className.replace("is-", "") + ":" + li.querySelector("span").textContent),
    tiles: qa(".wall .tile").map(t => t.querySelector(".tile-label").textContent + "|" + t.querySelector(".tile-value").textContent + "|" + t.querySelector(".tile-sub").textContent),
    caution: qa(".wall .tile.is-caution").length, answer: txt(".wall-answer"), answerEmpty: q(".wall-answer")?.classList.contains("is-empty"),
    record: qa(".wall-event").map(e => e.querySelector("time").textContent + " " + e.querySelector(".wall-event-text").textContent + " " + e.querySelector(".chip").textContent.trim()),
    recordEmpty: txt(".wall-empty"), listening: txt(".wall-listening"), modes: qa(".wall-mode button").map(b => b.textContent + ":" + b.getAttribute("aria-pressed")),
    bodyBg: getComputedStyle(document.body).backgroundColor,
  } })()`;
const pressMode = async mode => { await evaluate(`document.querySelector('.wall-mode [data-mode="${mode}"]').click()`); await sleep(80) };
const fits = () => evaluate(`({ scroll: document.documentElement.scrollHeight - innerHeight, wide: document.documentElement.scrollWidth - innerWidth })`);

try {
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  await size(1280, 800);
  await navigate(harness.url + "#prep-c1");
  await waitFor(`!!document.querySelector(".prep-wall-link")`);
  await evaluate(`document.querySelector(".prep-wall-link").click()`);
  await waitFor(`!!document.querySelector(".wall-name")`);
  let s = await evaluate(READ);
  check("Case prep's Open theatre display button opens Ravi's wall", s.hash === "#theatre-c1" && s.chrome === "none" && s.bodyBg === "rgb(10, 15, 14)", JSON.stringify({ hash: s.hash, chrome: s.chrome, bg: s.bodyBg }));
  check("Screen readers get a heading that names the patient", s.h1 === "Theatre display for Ravi Kumar" && s.h1Hidden, s.h1);

  // Live view.
  const now = await evaluate(`(() => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") })()`);
  check("Live: patient, side, procedure, theatre and blood group", s.name === "Ravi Kumar" && s.facts === "64, Male, blood B+" && s.side === "LEFT" && s.proc === "Total knee replacement" && s.theatre === "OT 1", JSON.stringify({ name: s.name, facts: s.facts, side: s.side, proc: s.proc, theatre: s.theatre }));
  check("Live: the clock shows the real time and nothing is marked as a sample", s.clock === now && !s.sampleTag, JSON.stringify({ clock: s.clock, now, sample: s.sampleTag }));
  check("Live: the penicillin allergy band is red", /is-allergy/.test(s.allergyClass) && /Allergy: Penicillin.*Anaphylaxis/.test(s.allergy), s.allergy);
  check("Live: the allergy clash warning shows on the wall", s.warnings.length === 1 && /Cefazolin is in the plan/.test(s.warnings[0]), JSON.stringify(s.warnings));
  check("Live: pre-op status shows Blocked with 2 items", s.preop === "Pre-op blocked: 2 items", s.preop);
  check("Live: 10 steps, none marked as current yet", s.steps.length === 10 && s.steps.every(x => x.startsWith("next:")), JSON.stringify(s.steps.slice(0, 3)));
  check("Live: timers say Not started instead of showing made-up numbers", s.tiles.join() === "Tourniquet|–|Not started,Since incision|–|Not started,Anaesthesia|–|Not started", JSON.stringify(s.tiles));
  check("Live: no answer or microphone pretends to work", s.answerEmpty && s.answer === "No questions yet." && s.listening === "Microphone off", JSON.stringify({ answer: s.answer, listening: s.listening }));
  check("Live: the record starts empty", s.recordEmpty === "No entries yet." && s.record.length === 0, s.recordEmpty);
  check("Live is selected in the view switch", s.modes.join() === "Live:true,Sample moment:false", s.modes.join());
  let f = await fits();
  check("Laptop 1280×800, live: everything fits on one screen", f.scroll <= 0 && f.wide <= 0, JSON.stringify(f));
  if (shotsDir) await shot("laptop-wall-live.png");

  // The live record updates by itself through the endpoint layer.
  await evaluate(`OT.api.addEvent("c1", { type: "note", text: "Patient in theatre", source: "typed", by: "Circulating nurse" })`);
  await waitFor(`document.querySelectorAll(".wall-event").length === 1`);
  await evaluate(`window.__heard = OT.api.addEvent("c1", { type: "drug", text: "Vancomycin 1 g IV", source: "voice", heard: "one gram of vanc" })`);
  await waitFor(`document.querySelectorAll(".wall-event").length === 2`);
  s = await evaluate(READ);
  check("A typed entry appears on the wall by itself, confirmed", /Patient in theatre Confirmed$/.test(s.record[0] || ""), JSON.stringify(s.record));
  check("A heard entry appears as Suggested until someone confirms it", /Vancomycin 1 g IV Suggested$/.test(s.record[1] || ""), JSON.stringify(s.record));
  await evaluate(`window.__heard.then(e => OT.api.rejectEvent(e.id, { by: "Circulating nurse", reason: "Not given yet" }))`);
  await waitFor(`document.querySelectorAll(".wall-event").length === 1`);
  check("A rejected entry leaves the wall", (await evaluate(READ)).record.length === 1);

  // Sample moment, clearly marked.
  await pressMode("sample");
  s = await evaluate(READ);
  check("Sample moment is marked on screen and in the switch", s.sampleTag && s.modes.join() === "Live:false,Sample moment:true", JSON.stringify({ tag: s.sampleTag, modes: s.modes }));
  check("Sample moment: clock 10:59, four steps done, Bone cuts current", s.clock === "10:59" && s.steps.slice(0, 4).every(x => x.startsWith("done:")) && s.steps[4] === "current:Bone cuts" && s.steps[5].startsWith("next:"), JSON.stringify(s.steps.slice(0, 6)));
  check("Sample moment: timers 38, 31 and 52 minutes with their start times", s.tiles.join() === "Tourniquet|38min|On since 10:21,Since incision|31min|Incision at 10:28,Anaesthesia|52min|Started at 10:07" && s.caution === 0, JSON.stringify(s.tiles));
  check("Sample moment: the answer shows its source", /Which implant size did we plan\?.*Femoral 5, tibial 4, insert 10 mm.*Source: surgical plan/.test(s.answer), s.answer);
  check("Sample moment: 6 entries, the last one waiting for the nurse", s.record.length === 6 && s.record[0] === "09:40 Vancomycin 1 g IV Confirmed" && s.record[5] === "10:58 Femoral component size 5 opened Suggested", JSON.stringify(s.record));
  check("Sample moment: listening shows what was heard; the warning strip is hidden", /^Listening.*okay, open the size five femoral/.test(s.listening) && s.warnings.length === 0, JSON.stringify({ listening: s.listening, warnings: s.warnings }));
  f = await fits();
  check("Laptop 1280×800, sample moment: everything fits on one screen", f.scroll <= 0 && f.wide <= 0, JSON.stringify(f));
  if (shotsDir) await shot("laptop-wall-sample.png");
  await pressMode("live");
  s = await evaluate(READ);
  check("Back to Live: the real record and clock return", !s.sampleTag && s.record.length === 1 && s.clock === now && s.tiles[0] === "Tourniquet|–|Not started", JSON.stringify({ tag: s.sampleTag, record: s.record, clock: s.clock }));

  // Readability on a 1080p TV or projector, from 3 m.
  await size(1920, 1080);
  await reload(); await waitFor(`!!document.querySelector(".wall-name")`); await pressMode("sample");
  const px = await evaluate(`(() => { const fs = s => Math.round(parseFloat(getComputedStyle(document.querySelector(s)).fontSize)); return {
    timer: fs(".wall .tile-value"), step: fs(".wall-steps li"), record: fs(".wall-event"), allergy: fs(".wall-allergy"), name: fs(".wall-name"), clock: fs(".wall-clock"), answer: fs(".wall-answer .answer-text") } })()`);
  check("TV 1920×1080: timers at least 100 px tall", px.timer >= 100, JSON.stringify(px));
  check("TV 1920×1080: steps and record text at least 26 px", px.step >= 26 && px.record >= 26, JSON.stringify(px));
  check("TV 1920×1080: allergy band, name, clock and answer at least 40 px", px.allergy >= 40 && px.name >= 40 && px.clock >= 40 && px.answer >= 40, JSON.stringify(px));
  f = await fits();
  check("TV 1920×1080, sample moment: everything fits on one screen", f.scroll <= 0 && f.wide <= 0, JSON.stringify(f));
  const strip = await evaluate(`(() => { const l = document.querySelector(".wall-listening"); return { h: Math.round(l.getBoundingClientRect().height), fs: parseFloat(getComputedStyle(l).fontSize) } })()`);
  check("TV 1920×1080: the listening strip stays one line tall when the warning strip is hidden", strip.h <= strip.fs * 3, JSON.stringify(strip));
  if (shotsDir) await shot("tv-wall-sample.png");
  await pressMode("live");
  f = await fits();
  check("TV 1920×1080, live: everything fits on one screen", f.scroll <= 0 && f.wide <= 0, JSON.stringify(f));

  // Contrast and layout in both views, on a laptop and a phone.
  for (const [w, h, mobile, tag] of [[1280, 800, false, "laptop"], [375, 812, true, "phone"]]) {
    await size(w, h, mobile);
    await reload(); await waitFor(`!!document.querySelector(".wall-name")`);
    for (const mode of ["live", "sample"]) {
      await pressMode(mode);
      const low = await evaluate("__qa.contrast()");
      check(`${tag} ${mode}: text contrast meets WCAG AA`, !low.length, low.slice(0, 6).join(" | "));
      const st = await evaluate("__qa.state()");
      check(`${tag} ${mode}: no sideways scrolling and every icon exists`, st.overflow <= 0 && !st.missingIcons.length, JSON.stringify({ overflow: st.overflow, missing: st.missingIcons }));
      if (mobile) { const small = await evaluate("__qa.touch()"); check(`${tag} ${mode}: tap targets at least 44 px`, !small.length, small.join(" | ")) }
      if (shotsDir && mobile && mode === "sample") await shot("phone-wall-sample.png");
    }
  }

  // Other patients.
  await size(1280, 800);
  await go("theatre-c2"); await waitFor(`/Arjun Rao/.test(document.querySelector(".wall-name")?.textContent || "")`);
  s = await evaluate(READ);
  check("Arjun: no tourniquet tile, no side, amber allergy band, no sample switch", s.tiles.length === 2 && !s.tiles[0].startsWith("Tourniquet") && s.side === "" && /is-unknown/.test(s.allergyClass) && s.modes.length === 0, JSON.stringify({ tiles: s.tiles, side: s.side, cls: s.allergyClass, modes: s.modes }));
  await go("theatre-c3"); await waitFor(`/Meera Iyer/.test(document.querySelector(".wall-name")?.textContent || "")`);
  s = await evaluate(READ);
  check("Meera: RIGHT side, no known allergies, pre-op checks done, no tourniquet planned", s.side === "RIGHT" && /is-none/.test(s.allergyClass) && s.preop === "Pre-op checks done" && s.tiles.length === 2, JSON.stringify({ side: s.side, preop: s.preop, tiles: s.tiles }));

  // Picker and a wrong link.
  await go("theatre"); await waitFor(`document.querySelectorAll(".pick").length === 3`);
  const picks = await evaluate(`[...document.querySelectorAll(".pick")].map(a => a.getAttribute("href"))`);
  check("Theatre display on its own lets you choose the operation", JSON.stringify(picks) === JSON.stringify(["#theatre-c1", "#theatre-c2", "#theatre-c3"]) && (await evaluate(`document.querySelector("#screen h1").textContent`)) === "Theatre display", JSON.stringify(picks));
  await go("theatre-zz9"); await waitFor(`!!document.querySelector(".wall-body [role=alert]")`);
  check("A wrong link says so and offers the list", /No operation with that ID.*Choose an operation/.test(await evaluate(`document.querySelector(".wall-body [role=alert]").textContent`)));

  // Leaving the wall stops its live updates.
  await evaluate(`window.__subs = 0; window.__real = OT.api; OT.api = Object.assign({}, window.__real, { watchEvents: (id, fn) => { window.__subs++; const stop = window.__real.watchEvents(id, fn); return () => { window.__subs--; stop() } } })`);
  await go("theatre-c1"); await waitFor(`!!document.querySelector(".wall-name")`);
  const during = await evaluate("window.__subs");
  await go("today"); await sleep(100);
  const after = await evaluate("window.__subs");
  await evaluate(`OT.api = window.__real`);
  check("Leaving the wall stops its live updates", during === 1 && after === 0, JSON.stringify({ during, after }));

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
console.log(`\n${results.length - failed}/${results.length} theatre display checks passed${failed ? "" : " (all)"}`);
if (shotsDir) console.log(`Screenshots saved in ${shotsDir}`);
process.exit(failed ? 1 : 0);
