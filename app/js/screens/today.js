// Today's list: today's operations in time order, with Ready or Blocked for each and the reasons.
// Gets its data only through the endpoint layer (OT.api).
(function (root) {
  "use strict";
  const OT = (root.OT = root.OT || {});
  OT.screens = OT.screens || {};

  const ALLERGY = {
    allergy: { cls: "chip-alarm", icon: "alert", text: a => `Allergy: ${a.items.map(i => i.substance).join(", ")}` },
    none: { cls: "chip-ok", icon: "check", text: () => "No known allergies" },
    unknown: { cls: "chip-caution", icon: "info", text: () => "Allergies not recorded" },
  };

  function render(view, { api, ui }) {
    const { el, icon, chip } = ui;

    const head = el("header", "screen-head"), box = el("div");
    const h1 = el("h1", null, "Today's list"); h1.tabIndex = -1;
    const meta = el("div", "today-meta");
    meta.append(el("p", "lede", ui.longDate()));
    if (api.source === "sample") meta.append(chip("chip-muted", "info", "Sample data, not saved"));
    box.append(h1, meta);
    head.append(box);
    const body = el("div", "today-body");
    view.append(head, body);
    return load();

    async function load() {
      body.setAttribute("aria-busy", "true");
      body.replaceChildren(el("p", "loading", "Loading today's list…"));
      try {
        const cases = await api.listCases();
        body.replaceChildren(...(cases.length ? content(cases) : [emptyDay()]));
      } catch (e) {
        body.replaceChildren(problem(e));
      } finally {
        body.removeAttribute("aria-busy");
      }
    }

    function content(cases) {
      const blocked = cases.filter(c => !c.readiness.ready).length, ready = cases.length - blocked;
      const summary = el("p", "today-summary");
      summary.append(
        el("span", "today-count", `${cases.length} ${cases.length === 1 ? "operation" : "operations"}`),
        chip(blocked ? "chip-alarm" : "chip-muted", "alert", `${blocked} blocked`),
        chip(ready ? "chip-ok" : "chip-muted", "check", `${ready} ready`),
      );
      const list = el("ol", "cases");
      list.setAttribute("aria-label", "Operations in time order");
      cases.forEach(c => list.append(caseRow(c)));
      return [summary, list, el("p", "today-foot", "Select an operation to open its case prep.")];
    }

    function caseRow(c) {
      const row = el("li", `case ${c.readiness.ready ? "is-ready" : "is-blocked"}`);

      const when = el("div", "case-when");
      const t = el("time", "data case-time", ui.time(c.start)); t.dateTime = c.start;
      when.append(t, el("span", "case-theatre", c.theatre));

      const who = el("div", "case-who");
      const allergy = ALLERGY[c.patient.allergy.state];
      const name = el("h2", "case-name"), link = el("a", "case-link", c.patient.name);
      link.href = `#prep-${c.id}`; // the whole row opens Case prep
      name.append(link);
      who.append(
        name,
        el("p", "case-facts", `${c.patient.age}, ${c.patient.sex}, Demo ID ${c.patient.demoId}`),
        chip(allergy.cls, allergy.icon, allergy.text(c.patient.allergy)),
      );

      const what = el("div", "case-what");
      const proc = el("p", "case-proc");
      if (c.side) proc.append(el("span", "side", c.side));
      proc.append(c.procedure);
      const team = el("dl", "case-team");
      for (const [role, name] of [["Surgeon", c.surgeon], ["Anaesthetist", c.anaesthetist]]) {
        const pair = el("div"); pair.append(el("dt", null, role), el("dd", null, name)); team.append(pair);
      }
      what.append(proc, team);

      const status = c.readiness.ready ? chip("chip-ok", "check", "Ready") : chip("chip-alarm", "alert", "Blocked");
      status.classList.add("case-chip");
      let reasons;
      if (c.readiness.ready) reasons = el("p", "case-reasons is-ok", "All pre-op checks done");
      else { reasons = el("ul", "case-reasons"); c.readiness.reasons.forEach(r => reasons.append(el("li", null, r.text))) }

      const go = icon("chevron"); go.classList.add("case-go"); // shows on touch screens, where there's no hover, that the row opens
      row.append(when, who, what, status, reasons, go);
      return row;
    }

    function emptyDay() {
      const panel = el("section", "planned");
      panel.append(el("h2", null, "No operations today"), el("p", null, "Operations booked for today will appear here, in time order."));
      return panel;
    }

    function problem(e) {
      const box = el("div", "alert alert-high");
      box.setAttribute("role", "alert");
      const text = el("div", "alert-text");
      text.append(el("b", null, "Today's list couldn't load"), el("span", null, e && e.message ? e.message : "Something went wrong."));
      const retry = el("button", "btn", "Try again"); retry.type = "button";
      retry.addEventListener("click", load);
      box.append(icon("alert"), text, retry);
      return box;
    }
  }

  OT.screens.today = { title: "Today's list", render };
})(window);
