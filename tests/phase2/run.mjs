// Phase 2 checks for Today's list in a real browser: the right operations in time order, Ready and Blocked
// with reasons, allergy labels, the 5-second test (every status visible without scrolling on a laptop),
// loading, a problem loading and an empty day. Runs on a laptop and a phone, in light and dark.
// Usage: node tests/phase2/run.mjs [--shots <folder>]   (set CHROME_PATH if Chrome is elsewhere)
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

// What the sample day must show, in this order.
const EXPECTED = [
  { name: "Ravi Kumar", time: "08:30", theatre: "OT 1", side: "LEFT", proc: "Total knee replacement", allergy: ["chip-alarm", "Allergy: Penicillin"], status: "Blocked", reasons: ["Crossmatched blood not ready", "Antibiotic not checked against allergies"] },
  { name: "Arjun Rao", time: "09:00", theatre: "OT 2", side: "", proc: "Keyhole gallbladder removal", allergy: ["chip-caution", "Allergies not recorded"], status: "Blocked", reasons: ["Allergies not recorded"] },
  { name: "Meera Iyer", time: "11:30", theatre: "OT 1", side: "RIGHT", proc: "Total hip replacement", allergy: ["chip-ok", "No known allergies"], status: "Ready", reasons: ["All pre-op checks done"] },
];
const READ_ROWS = `[...document.querySelectorAll(".case")].map(r => ({
  name: r.querySelector(".case-name").textContent, time: r.querySelector(".case-time").textContent, theatre: r.querySelector(".case-theatre").textContent,
  side: r.querySelector(".side")?.textContent || "", proc: r.querySelector(".case-proc").lastChild.textContent,
  allergy: [[...r.querySelector(".case-who .chip").classList].find(c => c.startsWith("chip-")), r.querySelector(".case-who .chip").textContent.trim()],
  status: r.querySelector(".case-chip").textContent.trim(),
  reasons: [...r.querySelectorAll(".case-reasons li")].map(li => li.textContent).concat(r.querySelector("p.case-reasons") ? [r.querySelector("p.case-reasons").textContent] : []),
  chipBottom: Math.round(r.querySelector(".case-chip").getBoundingClientRect().bottom),
}))`;

const harness = makeHarness(appDir);
const chrome = await openChrome(harness.url);
const { send, evaluate, reload, navigate, errors } = chrome;
const go = async route => { await evaluate(`location.hash = "#${route}"`); await sleep(150) };
const waitFor = async (expr, ms = 3000) => { for (let t = 0; t < ms; t += 50) { if (await evaluate(expr).catch(() => false)) return true; await sleep(50) } return false };
const shot = async file => { if (!shotsDir) return; const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(shotsDir, file), Buffer.from(r.data, "base64")) };
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

try {
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  for (const theme of ["light", "dark"]) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    for (const v of VIEWS) {
      const tag = `${v.name} ${theme}`;
      await send("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, deviceScaleFactor: v.mobile ? 2 : 1, mobile: v.mobile });
      await navigate(harness.url); // no screen in the address, so the app picks its start screen
      const s = await evaluate("__qa.state()");
      check(`${tag}: the app opens on Today's list`, s.title === "Today's list" && s.current === "today", JSON.stringify({ title: s.title, current: s.current }));
      await waitFor(`document.querySelectorAll(".case").length === 3`);
      const rows = await evaluate(READ_ROWS);
      for (let i = 0; i < EXPECTED.length; i++) {
        const want = EXPECTED[i], got = rows[i] || {};
        const same = ["name", "time", "theatre", "side", "proc", "status"].every(k => got[k] === want[k]) && JSON.stringify(got.allergy) === JSON.stringify(want.allergy) && JSON.stringify(got.reasons) === JSON.stringify(want.reasons);
        check(`${tag}: row ${i + 1} shows ${want.name}, ${want.status}`, same, JSON.stringify(got));
      }
      const summary = await evaluate(`document.querySelector(".today-summary")?.textContent || ""`);
      check(`${tag}: summary says 3 operations, 2 blocked, 1 ready`, /3 operations.*2 blocked.*1 ready/.test(summary), summary);
      check(`${tag}: marked as sample data`, await evaluate(`/Sample data, not saved/.test(document.querySelector(".today-meta").textContent)`));
      if (!v.mobile) check(`${tag}: 5-second test, every status is visible without scrolling`, rows.length === 3 && rows.every(r => r.chipBottom <= v.height), rows.map(r => r.chipBottom).join(", "));
      check(`${tag}: no sideways scrolling`, s.overflow <= 0, `${s.overflow}px too wide`);
      check(`${tag}: every icon exists`, !(await evaluate("__qa.state()")).missingIcons.length);
      const low = await evaluate("__qa.contrast()");
      check(`${tag}: text contrast meets WCAG AA`, !low.length, low.slice(0, 6).join(" | "));
      if (v.mobile) { const small = await evaluate("__qa.touch()"); check(`${tag}: tap targets at least 44 px`, !small.length, small.join(" | ")) }
      if (theme === "light") await shot(`${v.name}-today.png`);
      if (theme === "dark" && !v.mobile) await shot("laptop-today-dark.png");
    }
  }

  // Loading, a problem and an empty day, on a laptop. The endpoint layer is swapped for a test version.
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await reload();
  const swap = async body => { await evaluate(`window.__real = window.__real || OT.api; OT.api = Object.assign({}, window.__real, { listCases: ${body} })`); await go("style"); await go("today") };

  await swap(`() => new Promise(r => setTimeout(() => r([]), 600))`);
  const loading = await evaluate(`({ text: document.querySelector(".today-body").textContent, busy: document.querySelector(".today-body").getAttribute("aria-busy") })`);
  check("While loading, the screen says so", /Loading today's list/.test(loading.text) && loading.busy === "true", JSON.stringify(loading));
  await waitFor(`/No operations today/.test(document.querySelector(".today-body").textContent)`);
  check("An empty day says there are no operations", await evaluate(`/No operations today/.test(document.querySelector(".today-body").textContent) && !document.querySelector(".today-body").hasAttribute("aria-busy")`));

  // A passing problem: the first request fails, the next one works.
  await swap(`(() => { let calls = 0; return (...a) => calls++ === 0 ? Promise.reject(Object.assign(new Error("The hospital data didn't load. Reload the page."), { code: "unavailable" })) : window.__real.listCases(...a) })()`);
  await waitFor(`!!document.querySelector(".today-body [role=alert]")`);
  const problem = await evaluate(`document.querySelector(".today-body [role=alert]")?.textContent || ""`);
  check("A loading problem is explained, with Try again", /couldn't load.*didn't load\. Reload the page\..*Try again/.test(problem), problem);
  await evaluate(`[...document.querySelectorAll(".today-body button")].find(b => b.textContent === "Try again").click()`);
  check("Try again loads the list once the problem is gone", await waitFor(`document.querySelectorAll(".case").length === 3`));
  await evaluate(`OT.api = window.__real`);

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
console.log(`\n${results.length - failed}/${results.length} Today's list checks passed${failed ? "" : " (all)"}`);
if (shotsDir) console.log(`Screenshots saved in ${shotsDir}`);
process.exit(failed ? 1 : 0);
