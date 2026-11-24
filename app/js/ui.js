// Small helpers every screen uses: finding and making elements, icons, times and the toast message.
(function (root) {
  "use strict";
  const OT = (root.OT = root.OT || {});
  const SVG = "http://www.w3.org/2000/svg";

  const $ = (s, scope = document) => scope.querySelector(s);
  const $$ = (s, scope = document) => [...scope.querySelectorAll(s)];
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  // An icon from the sprite in index.html, hidden from screen readers (the text beside it says the same).
  function icon(name) {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "icon"); svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(SVG, "use"); use.setAttribute("href", `#i-${name}`);
    svg.append(use);
    return svg;
  }
  function chip(cls, iconName, text) {
    const c = el("span", `chip ${cls}`);
    if (iconName) c.append(icon(iconName));
    c.append(text);
    return c;
  }
  const pad = n => String(n).padStart(2, "0");
  // 24-hour clock, as in our writing rules: 09:40.
  const time = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  const longDate = (d = new Date()) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Today's operations as a list of links, used by Case prep and the theatre display to pick a case.
  function casePicker(cases, hrefFor, label = "Today's operations") {
    const list = el("ul", "pick-list");
    list.setAttribute("aria-label", label);
    for (const c of cases) {
      const a = el("a", "pick"); a.href = hrefFor(c);
      const t = el("time", "pick-time", time(c.start)); t.dateTime = c.start;
      const what = el("span", "pick-what");
      what.append(el("b", null, c.patient.name), el("span", null, c.side ? `${c.side} ${c.procedure.toLowerCase()}` : c.procedure));
      a.append(t, what, c.readiness.ready ? chip("chip-ok", "check", "Ready") : chip("chip-alarm", "alert", "Blocked"), icon("chevron"));
      const li = el("li"); li.append(a); list.append(li);
    }
    return list;
  }

  // Loads a library script once (only from the CDN claude.ai allows) and resolves with its global.
  const loading = {};
  function loadScript(url, globalName) {
    if (root[globalName]) return Promise.resolve(root[globalName]);
    if (!loading[url]) loading[url] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = () => root[globalName] ? resolve(root[globalName]) : reject(new Error("The PDF maker didn't start. Reload the page and try again."));
      s.onerror = () => { delete loading[url]; reject(new Error("The PDF maker couldn't load. Check the internet connection and try again.")) };
      document.head.append(s);
    });
    return loading[url];
  }

  // claude.ai's file saving. Resolves null outside claude.ai (for example, a file opened on its own).
  async function downloads() {
    try { return root.claude && root.claude.use ? await root.claude.use("downloads") : null } catch { return null }
  }

  let toastTimer = 0;
  function toast(message) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = message; t.dataset.show = "true";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.dataset.show = "false" }, 2800);
  }

  OT.ui = Object.freeze({ $, $$, el, icon, chip, time, longDate, casePicker, loadScript, downloads, toast });
})(window);
