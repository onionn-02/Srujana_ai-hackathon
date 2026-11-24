// Phase 3 checks for Case prep in a real browser: opening a case from Today's list, the patient band,
// Ready or Blocked, the allergy clash warning, the checklist (ticks record who and when, and change Ready),
// the surgical plan, the patient record, the case picker, a wrong link, and layout on a laptop and a phone,
// in light and dark. Usage: node tests/phase3/run.mjs [--shots <folder>]
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openChrome, makeHarness, sleep } from "../lib/chrome.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "../../app");
const shotsAt = process.argv.indexOf("--shots");
const shotsDir = shotsAt > -1 ? process.argv[shotsAt + 1] : null;
const VIEWS = [{ name: "laptop", width: 1280, height: 800, mobile: false }, { name: "phone", width: 375, height: 812, mobile: true }];

const results = [];
const check = (name, pass, info = "") => results.push({ name, pass: !!pass, info });

const harness = makeHarness(appDir);
const chrome = await openChrome(harness.url);
const { send, evaluate, key, reload, navigate, errors } = chrome;
const go = async route => { await evaluate(`location.hash = "#${route}"`); await sleep(150) };
const waitFor = async (expr, ms = 3000) => { for (let t = 0; t < ms; t += 50) { if (await evaluate(expr).catch(() => false)) return true; await sleep(50) } return false };
const shot = async (file, full) => {
  if (!shotsDir) return;
  let opts = { format: "png" };
  if (full) { const h = await evaluate("document.documentElement.scrollHeight"); const w = await evaluate("innerWidth"); opts = { ...opts, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } } }
  const r = await send("Page.captureScreenshot", opts);
  writeFileSync(join(shotsDir, file), Buffer.from(r.data, "base64"));
};
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

// Reads everything on the Case prep screen.
const READ = `(() => {
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)], txt = s => q(s)?.textContent.trim() || "";
  return {
    hash: location.hash, title: txt("#screen h1"), current: q('#nav a[aria-current="page"]')?.dataset.route,
    name: txt(".band-name"), side: txt(".band .side"), allergyClass: q(".band-allergy")?.className || "", allergy: txt(".band-allergy"),
    status: txt(".prep-status .chip"), reasons: qa(".prep-reasons li").map(li => li.textContent), statusText: txt(".prep-status"),
    warnings: qa(".prep-warnings .alert").map(a => [a.className.replace("alert ", ""), a.textContent.trim()]), okLine: txt(".ok-line"),
    count: txt(".panel-sub"), checks: qa(".check input").map(i => i.checked), checkNotes: qa(".check small").map(s => s.textContent),
    steps: qa(".steps li").length, implants: qa('table:has(caption) tbody tr').length,
    tables: qa("table").map(t => t.querySelector("caption").textContent + ": " + [...t.querySelectorAll("tbody tr")].map(r => [...r.cells].map(c => c.textContent).join(" / ")).join(" | ")),
    noImplants: /No implants planned/.test(document.body.textContent), noDrugs: /No drugs planned/.test(document.body.textContent),
    record: txt('[aria-labelledby="prep-record-h"] .record'), sample: /Sample data, not saved/.test(txt(".prep-meta")), meta: txt(".prep-when"),
  } })()`;
const tick = async (id, role) => {
  await evaluate(`(() => { const s = document.getElementById("prep-role"); s.value = ${JSON.stringify(role)}; s.dispatchEvent(new Event("change")); document.getElementById(${JSON.stringify(id)}).click() })()`);
  await sleep(120);
};

try {
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await navigate(harness.url);
  await evaluate(`try { localStorage.removeItem("ot-role") } catch {}`);
  await waitFor(`document.querySelectorAll(".case").length === 3`);

  // Open Ravi's case from Today's list by clicking his row.
  await evaluate(`document.querySelector(".case .case-link").click()`);
  await waitFor(`!!document.querySelector(".band-name")`);
  let s = await evaluate(READ);
  check("Clicking a row on Today's list opens that case", s.hash === "#prep-c1" && s.title === "Case prep" && s.current === "prep" && s.name === "Ravi Kumar", JSON.stringify({ hash: s.hash, title: s.title, current: s.current, name: s.name }));
  check("Time, theatre and sample-data label are shown", s.meta === "08:30 in OT 1" && s.sample, JSON.stringify({ meta: s.meta, sample: s.sample }));
  check("Patient band: LEFT side and the penicillin allergy in red", s.side === "LEFT" && /is-allergy/.test(s.allergyClass) && /Allergy: Penicillin.*Anaphylaxis/.test(s.allergy), JSON.stringify({ side: s.side, cls: s.allergyClass, allergy: s.allergy }));
  check("Blocked, with both reasons", s.status === "Blocked" && JSON.stringify(s.reasons) === JSON.stringify(["Crossmatched blood not ready", "Antibiotic not checked against allergies"]), JSON.stringify({ status: s.status, reasons: s.reasons }));
  check("The allergy clash warning comes from the safety rule", s.warnings.length === 1 && s.warnings[0][0] === "alert-high" && /Cefazolin is in the plan.*penicillin allergy with anaphylaxis.*Review possible cross-reaction/.test(s.warnings[0][1]), JSON.stringify(s.warnings));
  check("Checklist: 9 checks, 7 done, each tick says who and when", s.checks.length === 9 && s.checks.filter(Boolean).length === 7 && s.count === "7 of 9 done" && s.checkNotes[0] === "Ticked by Ward nurse at 07:10" && s.checkNotes[7] === "Not done", JSON.stringify({ count: s.count, notes: s.checkNotes }));
  check("Plan: 10 steps, 3 implants and 2 drugs with doses", s.steps === 10 && s.tables[0] === "Planned implants: Femoral component / 5 | Tibial component / 4 | Insert / 10 mm" && /^Planned drugs: Cefazolin \/ 2 g \/ IV \/ Within 60 minutes before incision \| Tranexamic acid \/ 1 g \/ IV/.test(s.tables[1]), JSON.stringify(s.tables));
  check("Patient record: date of birth, allergy, conditions and blood group", /14 March 1962/.test(s.record) && /Penicillin: anaphylaxis \(severe\)/.test(s.record) && /Type 2 diabetes/.test(s.record) && /Group B\+/.test(s.record), s.record);

  // Ticking: who and when, and Ready changes.
  await tick("chk-c1-crossmatch", "Blood bank");
  s = await evaluate(READ);
  check("Ticking records the chosen role and the time", /^Ticked by Blood bank at \d\d:\d\d$/.test(s.checkNotes[7]) && s.count === "8 of 9 done", JSON.stringify({ note: s.checkNotes[7], count: s.count }));
  check("One reason left after the first tick", s.status === "Blocked" && JSON.stringify(s.reasons) === JSON.stringify(["Antibiotic not checked against allergies"]), JSON.stringify(s.reasons));
  await tick("chk-c1-antibiotic", "Anaesthetist");
  s = await evaluate(READ);
  check("When every check is done, the case is Ready for theatre", s.status === "Ready for theatre" && s.count === "9 of 9 done" && /All pre-op checks are done/.test(s.statusText), JSON.stringify({ status: s.status, count: s.count }));
  check("The allergy warning stays until the plan changes", s.warnings.length === 1, JSON.stringify(s.warnings));
  await go("today"); await waitFor(`document.querySelectorAll(".case").length === 3`);
  const today = await evaluate(`({ first: document.querySelector(".case .case-chip").textContent.trim(), summary: document.querySelector(".today-summary").textContent })`);
  check("Today's list shows Ravi as Ready after the ticks", today.first === "Ready" && /1 blocked.*2 ready/.test(today.summary), JSON.stringify(today));
  await go("prep-c1"); await waitFor(`!!document.querySelector(".band-name")`);
  await tick("chk-c1-antibiotic", "Anaesthetist");
  s = await evaluate(READ);
  check("Unticking makes the case Blocked again", s.status === "Blocked" && s.checkNotes[8] === "Not done", JSON.stringify({ status: s.status, note: s.checkNotes[8] }));
  await evaluate(`document.getElementById("chk-c1-antibiotic").focus()`);
  await key(" ", "Space", 32, " "); await sleep(150);
  s = await evaluate(READ);
  check("The keyboard Space bar ticks a check too", s.checks[8] === true && s.status === "Ready for theatre", JSON.stringify({ checked: s.checks[8], status: s.status }));
  check("Focus stays on the check after ticking", await evaluate(`document.activeElement.id === "chk-c1-antibiotic"`));

  // Not saved yet: a reload starts fresh, but the chosen role is remembered on this device.
  await reload(); await waitFor(`!!document.querySelector(".band-name")`);
  s = await evaluate(READ);
  const role = await evaluate(`document.getElementById("prep-role").value`);
  check("A reload starts the ticks again, as the screen says", s.count === "7 of 9 done" && s.status === "Blocked", JSON.stringify({ count: s.count, status: s.status }));
  check("The Ticking as choice is remembered on this device", role === "Anaesthetist", role);

  // Arjun: allergies not recorded, no implants, no drugs.
  await go("prep-c2"); await waitFor(`/Arjun Rao/.test(document.querySelector(".band-name")?.textContent || "")`);
  s = await evaluate(READ);
  check("Arjun: allergies not recorded in amber, and that blocks the case", /is-unknown/.test(s.allergyClass) && /Allergies not recorded/.test(s.allergy) && s.status === "Blocked" && s.reasons.includes("Allergies not recorded") && s.side === "", JSON.stringify({ cls: s.allergyClass, reasons: s.reasons, side: s.side }));
  check("Arjun: no implants or drugs planned, so no drug warnings", s.noImplants && s.noDrugs && s.warnings.length === 0 && !s.okLine, JSON.stringify({ warnings: s.warnings, ok: s.okLine }));

  // Meera: ready, no known allergies, no clash.
  await go("prep-c3"); await waitFor(`/Meera Iyer/.test(document.querySelector(".band-name")?.textContent || "")`);
  s = await evaluate(READ);
  check("Meera: Ready, no known allergies, and the drugs were checked with no clash", s.status === "Ready for theatre" && /is-none/.test(s.allergyClass) && s.side === "RIGHT" && /No clashes/.test(s.okLine), JSON.stringify({ status: s.status, cls: s.allergyClass, ok: s.okLine }));

  // The picker and a wrong link.
  await go("prep"); await waitFor(`document.querySelectorAll(".pick").length === 3`);
  const picks = await evaluate(`[...document.querySelectorAll(".pick")].map(a => a.getAttribute("href") + " " + a.querySelector("b").textContent)`);
  check("Case prep on its own lists today's operations to choose from", JSON.stringify(picks) === JSON.stringify(["#prep-c1 Ravi Kumar", "#prep-c2 Arjun Rao", "#prep-c3 Meera Iyer"]), JSON.stringify(picks));
  await evaluate(`document.querySelectorAll(".pick")[2].click()`); await waitFor(`/Meera Iyer/.test(document.querySelector(".band-name")?.textContent || "")`);
  check("Choosing from the list opens that case", (await evaluate("location.hash")) === "#prep-c3");
  await go("prep-zz9"); await waitFor(`!!document.querySelector(".prep-body [role=alert]")`);
  const wrong = await evaluate(`document.querySelector(".prep-body [role=alert]")?.textContent || ""`);
  check("A wrong case link says so and offers the list of operations", /No operation with that ID.*Choose an operation/.test(wrong), wrong);

  // Layout, contrast and tap sizes on Ravi's case.
  for (const theme of ["light", "dark"]) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    for (const v of VIEWS) {
      await send("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, deviceScaleFactor: v.mobile ? 2 : 1, mobile: v.mobile });
      await go("prep-c1"); await reload(); await waitFor(`!!document.querySelector(".band-name")`);
      const tag = `${v.name} ${theme}`;
      const st = await evaluate("__qa.state()");
      check(`${tag}: no sideways scrolling`, st.overflow <= 0, `${st.overflow}px too wide`);
      check(`${tag}: every icon exists`, !st.missingIcons.length, st.missingIcons.join(", "));
      const low = await evaluate("__qa.contrast()");
      check(`${tag}: text contrast meets WCAG AA`, !low.length, low.slice(0, 6).join(" | "));
      if (v.mobile) { const small = await evaluate("__qa.touch()"); check(`${tag}: tap targets at least 44 px`, !small.length, small.join(" | ")) }
      if (theme === "light") await shot(`${v.name}-case-prep.png`, !v.mobile);
      if (theme === "dark" && !v.mobile) await shot("laptop-case-prep-dark.png");
    }
  }
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await go("prep"); await waitFor(`document.querySelectorAll(".pick").length === 3`);
  const pickTouch = await evaluate("__qa.touch()");
  check("phone light: the case picker's rows are easy to tap", !pickTouch.length && (await evaluate(`[...document.querySelectorAll(".pick")].every(a => a.getBoundingClientRect().height >= 44)`)), pickTouch.join(" | "));
  if (shotsDir) await shot("phone-case-picker.png");

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
console.log(`\n${results.length - failed}/${results.length} Case prep checks passed${failed ? "" : " (all)"}`);
if (shotsDir) console.log(`Screenshots saved in ${shotsDir}`);
process.exit(failed ? 1 : 0);
