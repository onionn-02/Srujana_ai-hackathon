// Phase 7 review: walks every screen and state (lists, cases, wrong links, style guide) on a laptop and a phone,
// in light and dark, and checks what a careful reviewer would: no sideways scrolling, contrast, tap sizes,
// one heading per screen, the tab title, a name on every button and link, a visible focus outline,
// no duplicate ids, decorative icons hidden from screen readers, very long names and texts, and the
// message shown when something unexpected goes wrong. Usage: node tests/phase7/run.mjs [--shots <folder>]
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openChrome, makeHarness, sleep } from "../lib/chrome.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "../../app");
const shotsAt = process.argv.indexOf("--shots");
const shotsDir = shotsAt > -1 ? process.argv[shotsAt + 1] : null;

const STATES = [
  ["Today's list", "today", ".case"],
  ["Case prep", "prep", ".pick"], ["Case prep", "prep-c1", ".band-name"], ["Case prep", "prep-c2", ".band-name"], ["Case prep", "prep-zz9", "[role=alert]"],
  ["Theatre display", "theatre", ".pick"], ["Theatre display", "theatre-c1", ".wall-name"], ["Theatre display", "theatre-zz9", "[role=alert]"],
  ["Nurse console", "nurse", ".pick"], ["Nurse console", "nurse-c1", ".nurse-who"], ["Nurse console", "nurse-zz9", "[role=alert]"],
  ["Operation notes", "notes", ".pick"], ["Operation notes", "notes-c1", ".note-paper .panel-head"], ["Operation notes", "notes-zz9", "[role=alert]"],
  ["Style guide", "style", ".sg"],
];
const VIEWS = [["laptop", 1280, 800, false], ["phone", 375, 812, true]];

const results = [];
const check = (name, pass, info = "") => results.push({ name, pass: !!pass, info });

const harness = makeHarness(appDir);
const chrome = await openChrome(harness.url);
const { send, evaluate, navigate, errors } = chrome;
const go = async route => { await evaluate(`location.hash = "#${route}"`); await sleep(150) };
const waitFor = async (expr, ms = 4000) => { for (let t = 0; t < ms; t += 50) { if (await evaluate(expr).catch(() => false)) return true; await sleep(50) } return false };
const shot = async file => { if (!shotsDir) return; writeFileSync(join(shotsDir, file), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64")) };
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

// Review helpers that run in the page.
const REVIEW = `window.__review = {
  // Every button, link and form control needs a name a screen reader can say.
  unnamed() {
    const named = el => {
      if (el.getAttribute("aria-label")?.trim()) return true;
      const by = el.getAttribute("aria-labelledby"); if (by && by.split(" ").some(id => document.getElementById(id)?.textContent.trim())) return true;
      if (el.id && document.querySelector('label[for="' + el.id + '"]')?.textContent.trim()) return true;
      if (el.closest("label")?.textContent.trim()) return true;
      return !!(el.textContent.trim() || el.title?.trim());
    };
    return [...document.querySelectorAll("#shell button, #shell a[href], #shell input, #shell select, #shell textarea, #shell summary")]
      .filter(el => el.getClientRects().length && !named(el)).map(el => el.outerHTML.slice(0, 80));
  },
  // Pressing Tab must show where focus is: an outline on the element, or on the row it stretches over.
  noFocusRing() {
    const bad = [];
    const items = [...document.querySelectorAll("#shell button:not([disabled]), #shell a[href], #shell input, #shell select, #shell textarea, #shell summary")]
      .filter(el => el.getClientRects().length && el.tabIndex >= 0).slice(0, 60);
    for (const el of items) {
      el.focus({ preventScroll: true });
      const target = el.matches(".case-link") ? el.closest(".case") : el;
      const s = getComputedStyle(target);
      const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
      if (!ring) bad.push(el.outerHTML.slice(0, 80));
    }
    document.activeElement?.blur();
    return bad;
  },
  duplicateIds() {
    const seen = new Map();
    for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) || 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  },
  loudIcons() { return [...document.querySelectorAll("#shell svg.icon")].filter(s => s.getAttribute("aria-hidden") !== "true").length },
  positiveTabindex() { return [...document.querySelectorAll("[tabindex]")].filter(el => el.tabIndex > 0).length },
  headings() { return [...document.querySelectorAll("#screen h1")].map(h => h.textContent.trim()) },
  clipped() {
    return [...document.querySelectorAll(".case, .band, .nurse-card, .nurse-row, .note-entry, .wall-event, .wall-head, .pick, .prep-meta, .alert, .panel")]
      .filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map(el => el.className + " " + el.scrollWidth + ">" + el.clientWidth);
  },
};`;

try {
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");

  for (const theme of ["light", "dark"]) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    for (const [vname, w, h, mobile] of VIEWS) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
      await navigate(harness.url + "#today");
      await evaluate(REVIEW);
      for (const [title, route, ready] of STATES) {
        await go(route);
        await waitFor(`!!document.querySelector(${JSON.stringify("#screen " + ready)})`);
        const tag = `${vname} ${theme} #${route}`;
        const st = await evaluate("__qa.state()");
        const heads = await evaluate("__review.headings()");
        const r = await evaluate(`({ unnamed: __review.unnamed(), dupes: __review.duplicateIds(), loud: __review.loudIcons(), pos: __review.positiveTabindex(), clipped: __review.clipped(), title: document.title })`);
        check(`${tag}: one screen heading and the right tab title`, heads.length === 1 && heads[0] && r.title === `${title} | OT Assistant`, JSON.stringify({ heads, title: r.title }));
        check(`${tag}: no sideways scrolling or clipped boxes`, st.overflow <= 0 && !r.clipped.length, JSON.stringify({ overflow: st.overflow, clipped: r.clipped.slice(0, 4) }));
        check(`${tag}: every button, link and field has a name`, !r.unnamed.length, r.unnamed.slice(0, 3).join(" | "));
        check(`${tag}: no duplicate ids, no positive tab order, decorative icons hidden`, !r.dupes.length && !r.pos && !r.loud && !st.missingIcons.length, JSON.stringify({ dupes: r.dupes, pos: r.pos, loud: r.loud, missing: st.missingIcons }));
        const low = await evaluate("__qa.contrast()");
        check(`${tag}: text contrast meets WCAG AA`, !low.length, low.slice(0, 4).join(" | "));
        if (mobile) { const small = await evaluate("__qa.touch()"); check(`${tag}: buttons big enough to tap`, !small.length, small.slice(0, 4).join(" | ")) }
        if (theme === "light" && !mobile) { const rings = await evaluate("__review.noFocusRing()"); check(`${tag}: a visible focus outline on everything you can Tab to`, !rings.length, rings.slice(0, 3).join(" | ")) }
        if (shotsDir && theme === "light") await shot(`${vname}-${route}.png`);
      }
    }
  }

  // Very long names and texts.
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await evaluate(`(async () => {
    const s = window.OT_SAMPLE;
    s.hims.patients[0].name = [{ given: ["Venkata", "Subrahmanya", "Lakshminarayana"], family: "Ramachandramurthy" }];
    s.templates.tkr.name = "Revision total knee replacement with tibial augment and stem extension";
    s.hims.allergies.push({ resourceType: "AllergyIntolerance", id: "al9", patient: { reference: "Patient/p1001" }, verificationStatus: "confirmed", code: { text: "Chlorhexidine skin preparation" }, reaction: [{ manifestation: [{ text: "Urticaria and bronchospasm" }], severity: "moderate" }] });
    await OT.api.reset();
    await OT.api.addEvent("c1", { type: "implant", text: "Femoral component size 5 posterior-stabilised cemented opened and handed to the scrub nurse", source: "voice", heard: "open the size five posterior stabilised femoral please" });
    await OT.api.addEvent("c1", { type: "note", text: "Patient positioned supine with a lateral post and a foot rest at ninety degrees of knee flexion", source: "typed", by: "Circulating nurse" });
  })()`);
  for (const [vname, w, h, mobile] of [...VIEWS, ["tv", 1920, 1080, false]]) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
    for (const route of ["today", "prep-c1", "theatre-c1", "nurse-c1", "notes-c1"]) {
      if (vname === "tv" && route !== "theatre-c1") continue;
      await go(route); await sleep(250);
      const st = await evaluate("__qa.state()"), clipped = await evaluate("__review.clipped()");
      check(`Long names and texts, ${vname} #${route}: nothing spills sideways`, st.overflow <= 0 && !clipped.length, JSON.stringify({ overflow: st.overflow, clipped: clipped.slice(0, 4) }));
      if (shotsDir && (route === "prep-c1" || route === "theatre-c1" || route === "nurse-c1")) await shot(`long-${vname}-${route}.png`);
    }
  }

  // An unexpected problem shows a plain message.
  await evaluate(`Promise.reject(new Error("review check: unexpected problem"))`).catch(() => {});
  await evaluate(`setTimeout(() => Promise.reject(new Error("review check: unexpected problem")), 0)`);
  await waitFor(`document.getElementById("toast").dataset.show === "true"`, 2000);
  check("Something unexpected going wrong shows a plain message instead of silence", /Something went wrong on this screen\. If it stops responding, reload the page\./.test(await evaluate(`document.getElementById("toast").textContent`)));

  const errs = errors().filter(e => !JSON.stringify(e.params).includes("review check: unexpected problem"));
  check("No script errors or failed loads during the review", !errs.length, errs.slice(0, 3).map(e => JSON.stringify(e.params).slice(0, 200)).join(" | "));
} catch (e) {
  check("The review ran to the end", false, String(e && e.stack || e));
} finally {
  await chrome.close();
  harness.remove();
}

let failed = 0;
for (const r of results) { if (!r.pass) { failed++; console.log(`FAIL  ${r.name}\n      ${r.info}`) } }
console.log(`\n${results.length - failed}/${results.length} review checks passed${failed ? "" : " (all)"}`);
if (shotsDir) console.log(`Screenshots saved in ${shotsDir}`);
process.exit(failed ? 1 : 0);
