// Phase 5 checks for the nurse console in a real browser, phone first: picking the case, the patient strip,
// practice suggestions (marked), Confirm in one tap, Reject with a second tap and a reason, Edit keeping the
// earlier version, Add entry, Scan label, who is confirming, the wall showing the same record, and thumb sizes
// with no side scrolling on small phones, plus laptop layout and dark mode.
// Usage: node tests/phase5/run.mjs [--shots <folder>]
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
const size = (w, h, mobile) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
const click = async (expr, wait = 120) => { await evaluate(`(${expr}).click()`); await sleep(wait) };
const shot = async file => { if (!shotsDir) return; const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(shotsDir, file), Buffer.from(r.data, "base64")) };
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const READ = `(() => {
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)], txt = s => q(s)?.textContent.trim() || "";
  return {
    hash: location.hash, title: txt("#screen h1"), name: txt(".nurse-who b"), side: txt(".nurse-who .side"), allergy: txt(".nurse-patient .chip"),
    allergyClass: q(".nurse-patient .chip")?.className || "", role: q("#nurse-role")?.value,
    count: q(".nurse-count")?.hidden ? "" : txt(".nurse-count"), waitingEmpty: txt(".nurse-cards .nurse-empty"),
    cards: qa(".nurse-card").map(c => ({ text: c.querySelector(".nurse-text")?.textContent, heard: c.querySelector(".nurse-heard")?.textContent || "", top: c.querySelector(".nurse-card-top")?.textContent || "", edited: c.querySelector(".nurse-edited")?.textContent || "", form: !!c.querySelector("form") })),
    rows: qa(".nurse-section .nurse-rows > .nurse-row").map(r => r.querySelector(".nurse-row-text").textContent),
    recordEmpty: txt(".nurse-section .nurse-rows .nurse-empty"),
    rejected: q(".nurse-rejected")?.hidden ? null : { summary: txt(".nurse-rejected summary"), rows: qa(".nurse-rejected .nurse-row").map(r => r.textContent) },
    panel: txt(".nurse-panel-host h2"), toast: q("#toast")?.dataset.show === "true" ? txt("#toast") : "",
    focus: (document.activeElement?.textContent || document.activeElement?.id || "").trim(),
  } })()`;

try {
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  await size(375, 812, true);
  await navigate(harness.url + "#nurse");
  await evaluate(`try { localStorage.removeItem("ot-role-nurse") } catch {}`);
  await waitFor(`document.querySelectorAll(".pick").length === 3`);
  const picks = await evaluate(`[...document.querySelectorAll(".pick")].map(a => a.getAttribute("href"))`);
  check("Nurse console on its own lets the nurse choose the operation", JSON.stringify(picks) === JSON.stringify(["#nurse-c1", "#nurse-c2", "#nurse-c3"]), JSON.stringify(picks));
  await click(`document.querySelector(".pick")`, 300);
  await waitFor(`!!document.querySelector(".nurse-who")`);
  let s = await evaluate(READ);
  check("Ravi's console: name, LEFT, red penicillin allergy", s.hash === "#nurse-c1" && s.title === "Nurse console" && s.name === "Ravi Kumar" && s.side === "LEFT" && /chip-alarm/.test(s.allergyClass) && s.allergy === "Allergy: Penicillin", JSON.stringify(s));
  check("Confirming as starts with Circulating nurse", s.role === "Circulating nurse", s.role);
  check("Nothing waiting and nothing in the record at first", /^Nothing waiting/.test(s.waitingEmpty) && s.recordEmpty === "Nothing in the record yet." && s.count === "" && s.rejected === null, JSON.stringify(s));
  const bar = await evaluate(`(() => { const b = document.querySelector(".nurse-bar").getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: innerHeight, buttons: [...document.querySelectorAll(".nurse-bar .btn")].map(x => Math.round(x.getBoundingClientRect().height)) } })()`);
  check("Phone: Add entry and Scan label sit at the bottom, in thumb reach, 56 px tall", bar.bottom === bar.h && bar.top >= bar.h * 0.85 && bar.buttons.every(h => h >= 56), JSON.stringify(bar));

  // Practice suggestions, clearly marked.
  await click(`[...document.querySelectorAll(".nurse-section .btn")].find(b => /practice/.test(b.textContent))`, 200);
  s = await evaluate(READ);
  check("Practice adds 3 suggestions, each marked Practice, with what was heard", s.cards.length === 3 && s.count === "3" && s.cards.every(c => /Practice/.test(c.top) && /Heard/.test(c.top) && /^Heard: “/.test(c.heard)), JSON.stringify(s.cards));
  if (shotsDir) await shot("phone-nurse-waiting.png");
  const thumbs = await evaluate(`[...document.querySelectorAll(".nurse-card .nurse-actions .btn")].map(b => Math.round(b.getBoundingClientRect().height))`);
  check("Phone: Confirm, Edit and Reject are 56 px tall", thumbs.length === 9 && thumbs.every(h => h >= 56), thumbs.join(","));
  const wide = await evaluate(`(() => { const c = document.querySelector(".nurse-confirm").getBoundingClientRect(), card = document.querySelector(".nurse-card").getBoundingClientRect(); return Math.round(c.width / card.width * 100) })()`);
  check("Phone: Confirm takes the card's full width", wide >= 85, `${wide}%`);

  // Confirm, one tap.
  await click(`document.querySelector(".nurse-confirm")`, 200);
  s = await evaluate(READ);
  check("Confirm moves the entry into the record, with who and when", s.cards.length === 2 && s.rows.length === 1 && /^Vancomycin 1 g IV.*Confirmed by Circulating nurse at \d\d:\d\d/.test(s.rows[0]), JSON.stringify(s.rows));
  check("After confirming, focus moves to the next Confirm button", s.focus === "Confirm", s.focus);
  check("Confirming says so", /^Confirmed: Vancomycin 1 g IV$/.test(s.toast), s.toast);

  // Reject, two taps, with a reason; and Keep it.
  await click(`[...document.querySelector(".nurse-card").querySelectorAll(".btn")].find(b => b.textContent === "Reject")`);
  s = await evaluate(READ);
  check("Reject first asks for a second tap, with an optional reason", s.cards[0].form && (await evaluate(`/Reject this entry\\?/.test(document.querySelector(".nurse-card").textContent) && document.activeElement.textContent === "Reject entry"`)), JSON.stringify(s.cards[0]));
  await click(`[...document.querySelectorAll(".nurse-card .btn")].find(b => b.textContent === "Keep it")`);
  s = await evaluate(READ);
  check("Keep it puts the buttons back and nothing is rejected", !s.cards[0].form && s.cards.length === 2 && s.rejected === null, JSON.stringify(s));
  await click(`[...document.querySelector(".nurse-card").querySelectorAll(".btn")].find(b => b.textContent === "Reject")`);
  await evaluate(`(() => { const i = document.querySelector(".nurse-card input"); i.value = "Misheard, not done yet"; })()`);
  await click(`[...document.querySelectorAll(".nurse-card .btn")].find(b => b.textContent === "Reject entry")`, 200);
  s = await evaluate(READ);
  check("Rejected entries leave the list and are kept, with the reason", s.cards.length === 1 && s.rejected && s.rejected.summary === "Rejected (1)" && /Tourniquet on, 250 mmHg.*Rejected by Circulating nurse at \d\d:\d\d\. Reason: Misheard, not done yet/.test(s.rejected.rows[0]), JSON.stringify(s.rejected));

  // Edit keeps the earlier version.
  await click(`[...document.querySelector(".nurse-card").querySelectorAll(".btn")].find(b => b.textContent === "Edit")`);
  await evaluate(`(() => { const i = document.querySelector('.nurse-card input[type="text"]'); i.value = "Femoral component size 6 opened" })()`);
  await click(`[...document.querySelectorAll(".nurse-card .btn")].find(b => b.textContent === "Save changes")`, 200);
  s = await evaluate(READ);
  check("Saving an edit shows the new text and notes the old one", s.cards.length === 1 && !s.cards[0].form && s.cards[0].text === "Femoral component size 6 opened" && /^Edited by Circulating nurse at \d\d:\d\d\. Was: Femoral component size 5 opened$/.test(s.cards[0].edited), JSON.stringify(s.cards[0]));
  check("An edited suggestion still waits for Confirm", s.count === "1", s.count);

  // Who is confirming.
  await evaluate(`(() => { const r = document.getElementById("nurse-role"); r.value = "Scrub nurse"; r.dispatchEvent(new Event("change")) })()`);
  await click(`document.querySelector(".nurse-confirm")`, 200);
  s = await evaluate(READ);
  check("Confirming as Scrub nurse records the Scrub nurse", /^Femoral component size 6 opened.*Confirmed by Scrub nurse/.test(s.rows[0]) && /Edited by Circulating nurse/.test(s.rows[0]), JSON.stringify(s.rows));
  check("With nothing left, focus goes to the Waiting heading", s.focus === "Waiting for you" && /^Nothing waiting/.test(s.waitingEmpty), JSON.stringify({ focus: s.focus }));

  // Edit a confirmed entry's time.
  const before = await evaluate(`document.querySelector(".nurse-section .nurse-rows > .nurse-row:last-child time").textContent`);
  await click(`document.querySelector(".nurse-section .nurse-rows > .nurse-row:last-child .btn")`);
  const earlier = await evaluate(`(() => { const t = document.querySelector('.nurse-row input[type="time"]'); const [h, m] = t.value.split(":").map(Number); const d = new Date(); d.setHours(h, m - 5, 0, 0); t.value = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); return t.value })()`);
  await click(`[...document.querySelectorAll(".nurse-row .btn")].find(b => b.textContent === "Save changes")`, 200);
  const after = await evaluate(`[...document.querySelectorAll(".nurse-section .nurse-rows > .nurse-row time")].map(t => t.textContent)`);
  check("A confirmed entry's time can be corrected", after.includes(earlier) && earlier !== before, JSON.stringify({ before, earlier, after }));

  // Add entry by hand.
  await click(`[...document.querySelectorAll(".nurse-bar .btn")].find(b => /Add entry/.test(b.textContent))`);
  s = await evaluate(READ);
  check("Add entry opens a form with the time already filled in", s.panel === "Add an entry" && (await evaluate(`/^\\d\\d:\\d\\d$/.test(document.getElementById("add-time").value) && document.activeElement.id === "add-type"`)), s.panel);
  await click(`[...document.querySelectorAll(".nurse-form .btn")].find(b => b.textContent === "Add to the record")`);
  check("An empty entry is refused with a clear message", /Add the details.*Describe what happened/.test(await evaluate(`document.querySelector(".nurse-form").textContent`)));
  await evaluate(`(() => { document.getElementById("add-type").value = "note"; document.getElementById("add-text").value = "Patient positioned supine"; const d = new Date(Date.now() + 30 * 60000); document.getElementById("add-time").value = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") })()`);
  await click(`[...document.querySelectorAll(".nurse-form .btn")].find(b => b.textContent === "Add to the record")`, 200);
  const future = await evaluate(`document.querySelector(".nurse-form")?.textContent || ""`);
  check("A time in the future is refused", /can't be in the future/.test(future), future.slice(0, 120));
  await evaluate(`(() => { const d = new Date(); document.getElementById("add-time").value = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") })()`);
  await click(`[...document.querySelectorAll(".nurse-form .btn")].find(b => b.textContent === "Add to the record")`, 200);
  s = await evaluate(READ);
  check("A typed entry goes straight into the record, confirmed by its author", s.panel === "" && /^Patient positioned supine.*Typed.*Confirmed by Scrub nurse/.test(s.rows[0]) && /Added to the record/.test(s.toast), JSON.stringify({ rows: s.rows, toast: s.toast }));
  check("After adding, focus returns to Add entry", /Add entry/.test(s.focus), s.focus);

  // Scan label: honest about Phase 17, with a way forward.
  await click(`[...document.querySelectorAll(".nurse-bar .btn")].find(b => /Scan label/.test(b.textContent))`);
  const scan = await evaluate(`document.querySelector(".nurse-panel-host").textContent`);
  check("Scan label says reading labels comes in Phase 17, and offers to add by hand", /comes in Phase 17/.test(scan), scan.slice(0, 160));
  await click(`[...document.querySelectorAll(".nurse-panel-host .btn")].find(b => /by hand/.test(b.textContent))`);
  check("Add implant by hand opens the form set to Implant", (await evaluate(`document.getElementById("add-type")?.value`)) === "implant");
  await click(`[...document.querySelectorAll(".nurse-form .btn")].find(b => b.textContent === "Cancel")`);

  // The wall on the same device shows the same record, with practice entries marked.
  await size(1280, 800, false);
  await go("theatre-c1"); await waitFor(`document.querySelectorAll(".wall-event").length > 0`);
  const wall = await evaluate(`[...document.querySelectorAll(".wall-event")].map(e => e.textContent.trim())`);
  check("The wall shows the nurse's confirmed entries, practice ones marked, rejected ones gone", wall.some(t => /Patient positioned supine.*Confirmed/.test(t)) && wall.some(t => /Femoral component size 6 opened.*Practice.*Confirmed/.test(t)) && !wall.some(t => /Tourniquet on, 250 mmHg/.test(t)), JSON.stringify(wall));
  check("An edit that only changed the time says so", /Time was \d\d:\d\d$/.test(await evaluate(`(location.hash = "#nurse-c1", new Promise(r => setTimeout(r, 250))).then(() => document.querySelector(".nurse-section .nurse-rows > .nurse-row:last-child .nurse-edited")?.textContent || "")`)));

  // Small phones and contrast, with practice suggestions on screen.
  await size(375, 812, true); await sleep(150);
  await click(`[...document.querySelectorAll(".nurse-section .btn")].find(b => /practice/.test(b.textContent))`, 200);
  for (const [w, h, theme] of [[375, 812, "light"], [360, 740, "light"], [375, 812, "dark"]]) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    await size(w, h, true); await sleep(150);
    const st = await evaluate("__qa.state()"), low = await evaluate("__qa.contrast()"), small = await evaluate("__qa.touch()");
    check(`${w}×${h} ${theme}: no side scrolling`, st.overflow <= 0, `${st.overflow}px too wide`);
    check(`${w}×${h} ${theme}: every button big enough for a thumb (44 px or more)`, !small.length, small.join(" | "));
    const oneLine = await evaluate(`[...document.querySelectorAll(".nurse-bar .btn")].every(b => b.getBoundingClientRect().height <= 64)`);
    check(`${w}×${h} ${theme}: Add entry and Scan label each fit on one line`, oneLine);
    check(`${w}×${h} ${theme}: the message bar never blocks taps`, (await evaluate(`getComputedStyle(document.getElementById("toast")).pointerEvents`)) === "none");
    check(`${w}×${h} ${theme}: text contrast meets WCAG AA`, !low.length, low.slice(0, 6).join(" | "));
    if (shotsDir && w === 360) await shot("phone-360-nurse.png");
    if (shotsDir && theme === "dark") await shot("phone-nurse-dark.png");
  }
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

  // Laptop layout.
  await size(1280, 800, false);
  await go("today"); await go("nurse-c1"); await waitFor(`!!document.querySelector(".nurse-who")`);
  const lap = await evaluate(`({ pos: getComputedStyle(document.querySelector(".nurse-bar")).position, overflow: document.documentElement.scrollWidth - innerWidth })`);
  check("Laptop: the action buttons sit at the top instead of a phone bar", lap.pos === "static" && lap.overflow <= 0, JSON.stringify(lap));
  if (shotsDir) await shot("laptop-nurse.png");

  // Remembered on this device, not saved.
  await size(375, 812, true); await reload(); await waitFor(`!!document.querySelector(".nurse-who")`);
  s = await evaluate(READ);
  check("A reload keeps the Confirming as choice but starts the record fresh, as the screen says", s.role === "Scrub nurse" && s.recordEmpty === "Nothing in the record yet.", JSON.stringify({ role: s.role, empty: s.recordEmpty }));
  await go("nurse-zz9"); await waitFor(`!!document.querySelector(".nurse-body [role=alert]")`);
  check("A wrong link says so and offers the list", /No operation with that ID.*Choose an operation/.test(await evaluate(`document.querySelector(".nurse-body [role=alert]").textContent`)));

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
console.log(`\n${results.length - failed}/${results.length} nurse console checks passed${failed ? "" : " (all)"}`);
if (shotsDir) console.log(`Screenshots saved in ${shotsDir}`);
process.exit(failed ? 1 : 0);
