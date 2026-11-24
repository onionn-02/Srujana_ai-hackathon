// Phase 1 checks: the app shell, the Screens menu, every screen and the style guide, on a laptop and a phone,
// in light and dark. Checks sideways scrolling, text contrast (WCAG AA), touch target size, icons,
// keyboard use, console errors and the style guide's sample interactions.
// Usage: node tests/phase1/run.mjs [--shots <folder>]   (set CHROME_PATH if Chrome is elsewhere)
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openChrome, makeHarness, sleep } from "../lib/chrome.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "../../app");
const shotsAt = process.argv.indexOf("--shots");
const shotsDir = shotsAt > -1 ? process.argv[shotsAt + 1] : null;

const TITLES = { style: "Style guide", today: "Today's list", prep: "Case prep", theatre: "Theatre display", nurse: "Nurse console", notes: "Operation notes" };
const VIEWS = [{ name: "laptop", width: 1280, height: 800, mobile: false }, { name: "phone", width: 375, height: 812, mobile: true }];

const results = [];
const check = (name, pass, info = "") => results.push({ name, pass: !!pass, info });

const harness = makeHarness(appDir);
const chrome = await openChrome(harness.url);
const { send, evaluate, key, reload, errors } = chrome;
const go = async route => { await evaluate(`location.hash = "#${route}"`); await sleep(150) };
const shot = async (file, clip) => {
  if (!shotsDir) return;
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!clip, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  writeFileSync(join(shotsDir, file), Buffer.from(r.data, "base64"));
};
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

try {
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  for (const theme of ["light", "dark"]) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    for (const v of VIEWS) {
      await send("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, deviceScaleFactor: v.mobile ? 2 : 1, mobile: v.mobile });
      await reload();
      check(`${v.name} ${theme}: Atkinson Hyperlegible font loaded`, await evaluate(`document.fonts.check('16px "Atkinson Hyperlegible Next"')`));
      for (const route of Object.keys(TITLES)) {
        await go(route);
        const s = await evaluate("__qa.state()");
        const tag = `${v.name} ${theme} #${route}`;
        check(`${tag}: right screen and menu item`, s.title === TITLES[route] && s.current === route, JSON.stringify({ title: s.title, current: s.current }));
        check(`${tag}: no sideways scrolling`, s.overflow <= 0, `${s.overflow}px too wide`);
        check(`${tag}: every icon exists`, !s.missingIcons.length, s.missingIcons.join(", "));
        const low = await evaluate("__qa.contrast()");
        check(`${tag}: text contrast meets WCAG AA`, !low.length, low.slice(0, 6).join(" | "));
        if (v.mobile) { const small = await evaluate("__qa.touch()"); check(`${tag}: tap targets at least 44 px`, !small.length, small.slice(0, 6).join(" | ")) }
        if (v.mobile && route !== "theatre") check(`${tag}: top bar keeps its height`, s.topbarHeight >= 56 && s.topbarHeight <= 72, `${s.topbarHeight}px tall`);
        if (route === "theatre") check(`${tag}: full screen with only a Screens button`, s.chrome === "none" && !s.rail && !s.topbar && s.floatBtn, JSON.stringify(s));
        else check(`${tag}: menu shown the right way for this size`, !s.floatBtn && (v.mobile ? (s.topbar && !s.rail) : (s.rail && !s.topbar)), JSON.stringify(s));
        if (shotsDir && theme === "light" && route === "style") {
          if (v.mobile) await shot("phone-style-guide.png");
          else {
            await evaluate("window.scrollTo(0, 0)"); await shot("laptop-style-guide.png");
            const r = await evaluate(`(() => { const b = document.querySelector(".theatre-sample").getBoundingClientRect(); return { x: 0, y: Math.round(b.top + scrollY - 70), width: 1280, height: Math.round(b.height + 90) } })()`);
            await shot("laptop-theatre-style.png", r);
          }
        }
        if (shotsDir && theme === "dark" && route === "style" && !v.mobile) { await evaluate("window.scrollTo(0, 0)"); await shot("laptop-style-guide-dark.png") }
      }
    }
  }

  // Interactions, on a phone in light mode.
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await reload(); await go("today");
  await evaluate(`document.querySelector(".topbar [data-menu-toggle]").click()`); await sleep(80);
  let s = await evaluate("__qa.state()");
  check("Phone: Screens button opens the menu and moves focus into it", s.menu === "open" && s.rail && (await evaluate(`!!document.activeElement.closest("#nav")`)), JSON.stringify(s));
  if (shotsDir) await shot("phone-menu-open.png");
  await key("Escape", "Escape", 27); await sleep(80);
  s = await evaluate("__qa.state()");
  const backOnButton = await evaluate(`document.activeElement.matches(".topbar [data-menu-toggle]")`);
  check("Phone: Escape closes the menu and returns focus to the button", s.menu === "closed" && !s.rail && backOnButton, JSON.stringify(s));
  await evaluate(`document.querySelector(".topbar [data-menu-toggle]").click()`); await sleep(60);
  await evaluate(`document.querySelector('#nav a[data-route="prep"]').click()`); await sleep(150);
  s = await evaluate("__qa.state()");
  check("Phone: choosing a screen in the menu opens it and closes the menu", s.title === "Case prep" && s.menu === "closed", JSON.stringify(s));
  await go("theatre");
  await evaluate(`document.querySelector(".float-menu").click()`); await sleep(80);
  s = await evaluate("__qa.state()");
  check("Theatre display: the Screens button opens the menu", s.menu === "open" && s.rail, JSON.stringify(s));
  await evaluate(`document.getElementById("scrim").click()`); await sleep(80);
  s = await evaluate("__qa.state()");
  check("Theatre display: tapping outside closes the menu", s.menu === "closed" && !s.rail, JSON.stringify(s));
  const bodyDark = await evaluate(`getComputedStyle(document.body).backgroundColor`);
  check("Theatre display: the whole page goes dark", bodyDark === "rgb(10, 15, 14)", bodyDark);

  // Interactions, on a laptop.
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await go("style"); await reload(); // a fresh page, so keyboard focus starts at the top
  await key("Tab", "Tab", 9);
  const skipFirst = await evaluate(`document.activeElement.classList.contains("skip")`);
  await key("Enter", "Enter", 13, "\r"); await sleep(80);
  s = await evaluate("__qa.state()");
  check("Keyboard: the first Tab reaches Skip to content, and it jumps to the screen", skipFirst && s.focus === "main" && s.title === "Style guide", JSON.stringify({ skipFirst, s }));
  await go("today"); await go("style");
  await evaluate(`location.hash = "#settings"`); await sleep(120);
  s = await evaluate("__qa.state()");
  check("An address that isn't a screen leaves the current screen open", s.title === "Style guide", JSON.stringify(s));
  const demo = await evaluate(`(async () => {
    const row = document.querySelector("[data-demo-event]"), chip = () => row.querySelector("[data-demo-status]").textContent.trim(), wait = () => new Promise(r => setTimeout(r, 60));
    const out = {};
    row.querySelector("[data-act=confirm]").click(); await wait(); out.confirmed = chip(); out.undoShown = !row.querySelector("[data-demo-undo]").hidden;
    row.querySelector("[data-act=undo]").click(); await wait(); out.afterUndo = chip();
    row.querySelector("[data-act=reject]").click(); await wait(); out.rejected = chip(); out.struck = row.classList.contains("is-rejected");
    row.querySelector("[data-act=undo]").click(); await wait(); out.reset = chip() === "Suggested" && !row.classList.contains("is-rejected");
    const box = document.getElementById("sg-c3"); box.click(); await wait(); out.tick = box.parentElement.querySelector("small").textContent;
    document.querySelector("[data-sample]").click(); await wait(); out.toast = document.getElementById("toast").dataset.show + " " + document.getElementById("toast").textContent;
    document.querySelector('[data-theme-choice="dark"]').click(); await wait(); out.dark = document.documentElement.dataset.theme + " " + getComputedStyle(document.body).backgroundColor;
    document.querySelector('[data-theme-choice="system"]').click(); await wait(); out.system = document.documentElement.hasAttribute("data-theme");
    try { localStorage.removeItem("ot-theme") } catch {}
    return out })()`);
  check("Live record sample: Confirm, Reject and Undo work", demo.confirmed === "Confirmed" && demo.undoShown && demo.afterUndo === "Suggested" && demo.rejected === "Rejected" && demo.struck && demo.reset, JSON.stringify(demo));
  check("Checklist sample: ticking shows who and when", /^Ticked by you at \d\d:\d\d/.test(demo.tick), demo.tick);
  check("Sample buttons say nothing was saved", /^true .*Nothing was saved/.test(demo.toast), demo.toast);
  check("Colour theme switch: Dark, then Match device", demo.dark === "dark rgb(14, 22, 20)" && demo.system === false, JSON.stringify({ dark: demo.dark, system: demo.system }));

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
console.log(`\n${results.length - failed}/${results.length} checks passed${failed ? "" : " (all)"}`);
if (shotsDir) console.log(`Screenshots saved in ${shotsDir}`);
process.exit(failed ? 1 : 0);
