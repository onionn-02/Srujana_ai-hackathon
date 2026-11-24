// OT Assistant app shell: screens, menu and the style guide's sample interactions.
// Plain scripts (no modules) so the offline copy in Phase 20 can open straight from a file.
// Screens get and change data only through the endpoint layer, OT.api (js/api.js).
(() => {
  "use strict";
  const { $, $$, el, toast } = OT.ui;

  // Every screen in the app.
  const SCREENS = {
    today: { title: "Today's list", module: "today" },
    prep: { title: "Case prep", module: "prep", param: true }, // #prep picks a case; #prep-c1 opens case c1
    theatre: { title: "Theatre display", module: "theatre", param: true, fullscreen: true }, // #theatre picks a case; #theatre-c1 shows it
    nurse: { title: "Nurse console", module: "nurse", param: true }, // #nurse picks a case; #nurse-c1 opens its console
    notes: { title: "Operation notes", module: "notes", param: true }, // #notes picks a case; #notes-c1 opens its note
    style: { title: "Style guide", template: "tpl-style" },
  };
  const START = "today";

  const shell = $("#shell"), view = $("#screen"), scrim = $("#scrim");
  const toggles = $$("[data-menu-toggle]");
  const wide = matchMedia("(min-width: 900px)");

  // ---------- screens ----------
  // Addresses are plain names, as claude.ai requires: #today, #prep, or #prep-c1 for one case.
  function parseHash() {
    const raw = location.hash.slice(1);
    if (Object.hasOwn(SCREENS, raw)) return { route: raw, param: null };
    const m = raw.match(/^([a-z]+)-([a-z0-9]+)$/i);
    if (m && Object.hasOwn(SCREENS, m[1]) && SCREENS[m[1]].param) return { route: m[1], param: m[2] };
    return null;
  }

  function screenHead(title, purpose) {
    const head = el("header", "screen-head"), box = el("div");
    const h1 = el("h1", null, title); h1.tabIndex = -1;
    box.append(h1);
    if (purpose) box.append(el("p", "lede", purpose));
    head.append(box);
    return head;
  }

  function brokenScreen(s, error) {
    const frag = document.createDocumentFragment();
    const box = el("div", "alert alert-high"); box.setAttribute("role", "alert");
    const text = el("div", "alert-text");
    text.append(el("b", null, `${s.title} didn't load`), el("span", null, error ? String(error.message || error) : "Reload the page to try again."));
    box.append(OT.ui.icon("alert"), text);
    frag.append(screenHead(s.title), box);
    return frag;
  }

  // Screens can register clean-up (stop live updates, clear timers) for when the team leaves them.
  let leaving = [], renderSeq = 0;
  function render(route, param, moveFocus) {
    const s = SCREENS[route];
    leaving.splice(0).forEach(fn => { try { fn() } catch {} });
    const seq = ++renderSeq;
    const isCurrent = () => seq === renderSeq;
    const onLeave = fn => { if (isCurrent()) leaving.push(fn); else { try { fn() } catch {} } };
    setMenu(false, false);
    view.replaceChildren();
    view.className = "screen" + (s.fullscreen ? " screen-full" : "");
    document.body.classList.toggle("theatre", !!s.fullscreen); // the whole page, menus included, goes dark
    shell.dataset.chrome = s.fullscreen ? "none" : "app";
    $$("#nav a").forEach(a => {
      if (a.dataset.route === route) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.title = `${s.title} | OT Assistant`; // the browser tab and screen readers say which screen this is
    if (s.module) {
      const screen = OT.screens && OT.screens[s.module];
      try {
        if (!screen) throw new Error("Its code didn't load. Reload the page to try again.");
        screen.render(view, { api: OT.api, ui: OT.ui, param, onLeave, isCurrent }); // draws its heading now, fills in data when it arrives
      } catch (e) { view.replaceChildren(brokenScreen(s, e)) }
    } else view.append($(`#${s.template}`).content.cloneNode(true));
    if (route === "style") initStyleGuide(view);
    if (moveFocus) { window.scrollTo(0, 0); const h1 = $("h1", view); if (h1) h1.focus({ preventScroll: true }) }
  }

  // ---------- menu (phones and the full-screen theatre display) ----------
  function setMenu(open, returnFocus = true) {
    const was = shell.dataset.menu === "open";
    shell.dataset.menu = open ? "open" : "closed";
    scrim.hidden = !open;
    toggles.forEach(b => b.setAttribute("aria-expanded", String(open)));
    if (open) { const target = $("#nav a[aria-current]") || $("#nav a"); if (target) target.focus() }
    else if (was && returnFocus) { const visible = toggles.find(b => b.getClientRects().length > 0); if (visible) visible.focus() }
  }
  toggles.forEach(b => b.addEventListener("click", () => setMenu(shell.dataset.menu !== "open")));
  scrim.addEventListener("click", () => setMenu(false));
  $("#nav").addEventListener("click", e => { if (e.target.closest("a")) setMenu(false, false) });
  // The skip link moves focus without changing the address, which would change the screen.
  $(".skip").addEventListener("click", e => { e.preventDefault(); $("#main").focus() });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && shell.dataset.menu === "open") setMenu(false) });
  wide.addEventListener("change", () => { if (wide.matches && shell.dataset.chrome === "app") setMenu(false, false) });

  // ---------- colour theme preview (only on this viewer's browser) ----------
  function savedTheme() { try { return localStorage.getItem("ot-theme") || "system" } catch { return "system" } }
  function applyTheme(choice, remember) {
    if (choice === "light" || choice === "dark") document.documentElement.dataset.theme = choice;
    else if (remember) delete document.documentElement.dataset.theme;
    if (remember) { try { localStorage.setItem("ot-theme", choice) } catch {} }
    $$("[data-theme-choice]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice)));
  }

  // ---------- style guide samples ----------
  function initStyleGuide(root) {
    applyTheme(savedTheme(), false); // marks the current choice as pressed
    $$("[data-theme-choice]", root).forEach(b => b.addEventListener("click", () => applyTheme(b.dataset.themeChoice, true)));
    $$("[data-sample]", root).forEach(b => b.addEventListener("click", () => toast(`${b.dataset.sample}: sample button only. Nothing was saved.`)));

    // The suggested entry: Confirm, Edit, Reject and Undo, kept on this page only.
    const row = $("[data-demo-event]", root);
    if (row) {
      const status = $("[data-demo-status]", row), actions = $("[data-demo-actions]", row), undo = $("[data-demo-undo]", row);
      const original = status.innerHTML;
      const setChip = (cls, icon, text) => { status.className = `chip ${cls}`; status.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${icon}"/></svg>`; status.append(text) };
      const flash = () => { row.classList.add("just-changed"); setTimeout(() => row.classList.remove("just-changed"), 600) };
      row.addEventListener("click", e => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (!act) return;
        if (act === "confirm") { setChip("chip-ok", "i-check", "Confirmed"); actions.hidden = true; undo.hidden = false; flash(); toast("Confirmed. Sample only, not saved.") }
        else if (act === "reject") { setChip("chip-muted", "i-close", "Rejected"); row.classList.add("is-rejected"); actions.hidden = true; undo.hidden = false; flash(); toast("Rejected. It stays out of the record.") }
        else if (act === "edit") toast("Edit opens the entry to change it. Sample button only.")
        else if (act === "undo") {
          status.className = "chip chip-caution"; status.innerHTML = original; row.classList.remove("is-rejected");
          actions.hidden = false; undo.hidden = true; flash(); const first = $("[data-act=confirm]", row); if (first) first.focus();
        }
        if (act === "confirm" || act === "reject") { const u = $("[data-act=undo]", row); if (u) u.focus() }
      });
    }

    // Checklist: show who ticked and when, on this page only.
    $$(".check input", root).forEach(box => box.addEventListener("change", () => {
      const note = box.parentElement.querySelector("small");
      if (!note) return;
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      note.textContent = box.checked ? `Ticked by you at ${time} (sample, not saved)` : "Not ticked";
    }));
  }

  // Anything that goes wrong outside a screen's own error handling still gets a plain message, never silence.
  let lastProblem = 0;
  function somethingWentWrong() {
    if (Date.now() - lastProblem < 4000) return;
    lastProblem = Date.now();
    toast("Something went wrong on this screen. If it stops responding, reload the page.");
  }
  window.addEventListener("error", somethingWentWrong);
  window.addEventListener("unhandledrejection", somethingWentWrong);

  // An address that isn't one of our screens (for example one claude.ai uses) leaves the current screen alone.
  window.addEventListener("hashchange", () => { const p = parseHash(); if (p) render(p.route, p.param, true) });
  applyTheme(savedTheme(), false);
  const first = parseHash() || { route: START, param: null };
  render(first.route, first.param, false);
})();
