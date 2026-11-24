// Case prep: everything about one patient before surgery. The patient band, Ready or Blocked,
// safety warnings, the pre-op checklist, the surgical plan and the patient record.
// Gets and changes data only through the endpoint layer (OT.api). The safety warnings are worked out there too.
(function (root) {
  "use strict";
  const OT = (root.OT = root.OT || {});
  OT.screens = OT.screens || {};

  const ROLES = ["Ward nurse", "Circulating nurse", "Anaesthetist", "Surgeon", "Blood bank"];
  const savedRole = () => { try { const r = localStorage.getItem("ot-role"); return ROLES.includes(r) ? r : ROLES[0] } catch { return ROLES[0] } };
  const keepRole = r => { try { localStorage.setItem("ot-role", r) } catch {} };
  const longBirthDate = iso => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  function render(view, { api, ui, param }) {
    const { el, icon, chip } = ui;

    const head = el("header", "screen-head"), box = el("div");
    const back = el("a", "back"); back.href = "#today"; back.append(icon("back"), "Today's list");
    const h1 = el("h1", null, "Case prep"); h1.tabIndex = -1;
    box.append(back, h1);
    head.append(box);
    const body = el("div", "prep-body");
    view.append(head, body);
    return param ? loadCase(param) : loadPicker();

    // ---------- loading states ----------
    function busy(message) { body.setAttribute("aria-busy", "true"); body.replaceChildren(el("p", "loading", message)) }
    function show(...parts) { body.replaceChildren(...parts.filter(Boolean)); body.removeAttribute("aria-busy") }
    function notice(cls, iconName, title, text, action) {
      const a = el("div", `alert ${cls}`); a.setAttribute("role", "alert");
      const t = el("div", "alert-text"); t.append(el("b", null, title), el("span", null, text));
      a.append(icon(iconName), t);
      if (action) a.append(action);
      return a;
    }
    function failed(title, e, retry) {
      const again = el("button", "btn", "Try again"); again.type = "button"; again.addEventListener("click", retry);
      show(notice("alert-high", "alert", title, e && e.message ? e.message : "Something went wrong.", again));
    }

    // ---------- no case chosen: pick one ----------
    async function loadPicker() {
      busy("Loading today's operations…");
      try {
        const cases = await api.listCases();
        if (!cases.length) { show(el("p", "lede", "There are no operations today.")); return }
        show(el("p", "lede", "Choose an operation to prepare."), ui.casePicker(cases, c => `#prep-${c.id}`));
      } catch (e) { failed("Today's operations couldn't load", e, loadPicker) }
    }

    // ---------- one case ----------
    async function loadCase(id) {
      busy("Loading the case…");
      let c;
      try { c = await api.getCase(id) } catch (e) {
        if (e && e.code === "not_found") {
          const link = el("a", "btn", "Choose an operation"); link.href = "#prep";
          show(notice("alert-medium", "info", "No operation with that ID", "The link may be wrong or out of date.", link));
        } else failed("This case couldn't load", e, () => loadCase(id));
        return;
      }
      const status = el("div", "prep-status"); status.setAttribute("aria-live", "polite");
      fillStatus(status, c.readiness);
      const grid = el("div", "prep-grid");
      grid.append(checklistPanel(c, status), planPanel(c));
      show(metaLine(c), band(c), status, warnings(c), otherScreens(c), grid, recordPanel(c));
    }

    function metaLine(c) {
      const meta = el("div", "prep-meta");
      const when = el("p", "prep-when");
      const t = el("time", null, ui.time(c.start)); t.dateTime = c.start;
      when.append(t, ` in ${c.theatre}`);
      const team = el("dl", "case-team");
      for (const [role, name] of [["Surgeon", c.surgeon], ["Anaesthetist", c.anaesthetist]]) {
        const pair = el("div"); pair.append(el("dt", null, role), el("dd", null, name)); team.append(pair);
      }
      meta.append(when, team);
      if (api.source === "sample") meta.append(chip("chip-muted", "info", "Sample data, not saved"));
      return meta;
    }

    // Links to this operation on the other screens. They come after the patient and safety information,
    // so on a phone the allergy and warnings are seen first.
    function otherScreens(c) {
      const nav = el("nav", "prep-links"); nav.setAttribute("aria-label", "This operation on other screens");
      for (const [cls, href, iconName, text] of [
        ["prep-wall-link", `#theatre-${c.id}`, "monitor", "Theatre display"],
        ["prep-nurse-link", `#nurse-${c.id}`, "phone", "Nurse console"],
        ["prep-notes-link", `#notes-${c.id}`, "note", "Operation note"],
      ]) { const a = el("a", `btn ${cls}`); a.href = href; a.append(icon(iconName), text); nav.append(a) }
      return nav;
    }

    function band(c) {
      const p = c.patient, a = p.allergy;
      const b = el("section", "band"); b.setAttribute("aria-label", "Patient");
      const id = el("div", "band-id"), facts = el("dl", "band-facts");
      for (const [label, value, cls] of [["Age", String(p.age)], ["Sex", p.sex], ["Demo ID", p.demoId, "data"]]) {
        const pair = el("div"); pair.append(el("dt", null, label), el("dd", cls || null, value)); facts.append(pair);
      }
      const proc = el("span", "band-proc");
      if (c.side) proc.append(el("span", "side", c.side));
      proc.append(c.procedure);
      id.append(el("span", "band-name", p.name), facts, proc);
      const state = a.state === "allergy" ? "allergy" : a.state === "none" ? "none" : "unknown";
      const allergy = el("div", `band-allergy is-${state}`), text = el("span");
      if (state === "allergy") text.append(el("strong", null, `Allergy: ${a.items.map(i => i.substance).join(", ")}`), el("span", null, a.items.map(i => i.reaction).filter(Boolean).join(", ") || "Reaction not recorded"));
      else if (state === "none") text.append(el("strong", null, "No known allergies"), el("span", null, "Checked and recorded"));
      else text.append(el("strong", null, "Allergies not recorded"), el("span", null, "Ask before giving drugs"));
      allergy.append(icon(state === "allergy" ? "alert" : state === "none" ? "check" : "info"), text);
      b.append(id, allergy);
      return b;
    }

    function fillStatus(box, r) {
      box.className = `prep-status ${r.ready ? "is-ready" : "is-blocked"}`;
      const parts = [r.ready ? chip("chip-ok", "check", "Ready for theatre") : chip("chip-alarm", "alert", "Blocked")];
      if (r.ready) parts.push(el("p", null, "All pre-op checks are done."));
      else { const list = el("ul", "prep-reasons"); r.reasons.forEach(x => list.append(el("li", null, x.text))); parts.push(list) }
      box.replaceChildren(...parts);
    }

    function warnings(c) {
      const box = el("section", "prep-warnings"); box.setAttribute("aria-label", "Safety checks");
      for (const w of c.warnings) {
        const [cls, iconName] = w.level === "high" ? ["alert-high", "alert"] : w.level === "medium" ? ["alert-medium", "alert"] : ["alert-advisory", "info"];
        const a = el("div", `alert ${cls}`), t = el("div", "alert-text");
        t.append(el("b", null, w.title), el("span", null, w.text));
        a.append(icon(iconName), t);
        box.append(a);
      }
      if (!c.warnings.length && c.plan.drugs.length && c.patient.allergy.state !== "unknown") {
        const okLine = el("p", "ok-line"); okLine.append(icon("check"), "No clashes between the planned drugs and the patient's allergies.");
        box.append(okLine);
      }
      return box.childNodes.length ? box : null;
    }

    function checklistPanel(c, status) {
      const panel = el("section", "panel"); panel.setAttribute("aria-labelledby", "prep-checks-h");
      const top = el("div", "panel-head"), titles = el("div");
      const h2 = el("h2", null, "Pre-op checklist"); h2.id = "prep-checks-h";
      const count = el("p", "panel-sub");
      const doneCount = () => { const n = c.checklist.filter(i => i.done).length; count.textContent = `${n} of ${c.checklist.length} done` };
      doneCount();
      titles.append(h2, count);
      const roleField = el("div", "field role-field");
      const label = el("label", null, "Ticking as"); label.htmlFor = "prep-role";
      const role = el("select"); role.id = "prep-role";
      ROLES.forEach(r => { const o = el("option", null, r); o.value = r; role.append(o) });
      role.value = savedRole();
      role.addEventListener("change", () => keepRole(role.value));
      roleField.append(label, role);
      top.append(titles, roleField);

      const problem = el("div"); problem.hidden = true;
      const list = el("div", "checks");
      const whoWhen = item => item.done ? `Ticked by ${item.by} at ${ui.time(item.at)}` : "Not done";
      for (const item of c.checklist) {
        const row = el("label", "check");
        const tick = el("input"); tick.type = "checkbox"; tick.id = `chk-${c.id}-${item.id}`; tick.checked = item.done;
        const text = el("span", null, item.label), small = el("small", null, whoWhen(item));
        text.append(small);
        row.append(tick, text);
        tick.addEventListener("change", async () => {
          const want = tick.checked, hadFocus = document.activeElement === tick;
          tick.disabled = true; problem.hidden = true;
          try {
            const r = await api.tickChecklist(c.id, item.id, { done: want, by: role.value });
            Object.assign(item, r.item);
            small.textContent = whoWhen(item);
            doneCount();
            fillStatus(status, r.readiness);
          } catch (e) {
            tick.checked = !want;
            problem.replaceChildren(notice("alert-high", "alert", "That tick wasn't recorded", e && e.message ? e.message : "Something went wrong. Try again."));
            problem.hidden = false;
          } finally {
            tick.disabled = false;
            if (hadFocus) tick.focus();
          }
        });
        list.append(row);
      }
      panel.append(top, problem, list, el("p", "panel-note", "Ticks aren't saved yet. Reloading the page starts again."));
      return panel;
    }

    function table(caption, columns, rows) {
      const wrap = el("div", "table-wrap"), t = el("table", "data-table");
      const cap = el("caption", "vh", caption), head = el("thead"), headRow = el("tr"), tbody = el("tbody");
      columns.forEach(col => { const th = el("th", null, col); th.scope = "col"; headRow.append(th) });
      head.append(headRow);
      rows.forEach(r => { const tr = el("tr"); r.forEach(v => tr.append(el("td", null, v))); tbody.append(tr) });
      t.append(cap, head, tbody);
      wrap.append(t);
      return wrap;
    }

    function planPanel(c) {
      const panel = el("section", "panel"); panel.setAttribute("aria-labelledby", "prep-plan-h");
      const h2 = el("h2", null, "Surgical plan"); h2.id = "prep-plan-h";
      const facts = el("dl", "record");
      for (const [label, value] of [["Operation", c.side ? `${c.side} ${c.procedure.toLowerCase()}` : c.procedure], ["Tourniquet", c.plan.tourniquet ? "Planned" : "Not planned"]]) {
        const pair = el("div"); pair.append(el("dt", null, label), el("dd", null, value)); facts.append(pair);
      }
      const steps = el("ol", "steps");
      c.plan.steps.forEach(s => steps.append(el("li", null, s)));
      const implants = c.plan.implants.length
        ? table("Planned implants", ["Part", "Planned size"], c.plan.implants.map(i => [i.part, i.size]))
        : el("p", "panel-sub", "No implants planned.");
      const drugs = c.plan.drugs.length
        ? table("Planned drugs", ["Drug", "Dose", "Route", "When"], c.plan.drugs.map(d => [d.name, d.dose, d.route, d.when || ""]))
        : el("p", "panel-sub", "No drugs planned.");
      panel.append(h2, facts, el("h3", null, "Steps"), steps, el("h3", null, "Implants"), implants, el("h3", null, "Drugs"), drugs,
        el("p", "panel-note", "Changing the plan comes in Phase 9."));
      return panel;
    }

    function recordPanel(c) {
      const p = c.patient;
      const panel = el("section", "panel"); panel.setAttribute("aria-labelledby", "prep-record-h");
      const h2 = el("h2", null, "Patient record"); h2.id = "prep-record-h";
      const record = el("dl", "record");
      const add = (label, value) => { const pair = el("div"); const dd = el("dd"); dd.append(value); pair.append(el("dt", null, label), dd); record.append(pair) };
      add("Date of birth", longBirthDate(p.birthDate));
      if (p.allergy.state === "allergy") {
        const list = el("ul");
        p.allergy.items.forEach(i => list.append(el("li", null, `${i.substance}: ${i.reaction ? i.reaction.toLowerCase() : "reaction not recorded"}${i.severity ? ` (${i.severity})` : ""}`)));
        add("Allergies", list);
      } else add("Allergies", p.allergy.state === "none" ? "No known allergies" : "Not recorded. Ask the patient or check their notes before giving drugs.");
      if (p.conditions.length) { const list = el("ul"); p.conditions.forEach(x => list.append(el("li", null, x))); add("Conditions", list) }
      else add("Conditions", "None recorded");
      const b = p.blood;
      add("Blood", b ? `Group ${b.group}. ${b.unitsRequested ? `${b.unitsRequested} units requested for crossmatch.` : "No crossmatch requested."}` : "Not recorded");
      panel.append(h2, record, el("p", "panel-note", "From the hospital record. Sample data in FHIR format, the standard hospitals use to share records."));
      return panel;
    }
  }

  OT.screens.prep = { title: "Case prep", render };
})(window);
