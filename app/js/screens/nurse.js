// Nurse console: the circulating nurse's phone screen. Confirm, edit or reject what the assistant suggests,
// see what's in the record, and add entries by hand. Built for one thumb: big buttons, main actions at the bottom.
// Gets and changes data only through the endpoint layer (OT.api). Nothing is saved yet (Phase 8), and changes
// reach other devices from Phase 11.
(function (root) {
  "use strict";
  const OT = (root.OT = root.OT || {});
  OT.screens = OT.screens || {};

  const ROLES = ["Circulating nurse", "Scrub nurse", "Anaesthetist", "Surgeon"];
  const TYPES = [["drug", "Drug given"], ["tourniquet", "Tourniquet"], ["implant", "Implant"], ["count", "Count"], ["step", "Step"], ["complication", "Complication"], ["note", "Note"]];
  const TYPE_LABEL = Object.fromEntries([...TYPES, ["plan-difference", "Plan difference"]]);
  const SOURCE = { voice: ["mic", "Heard"], scan: ["scan", "Scanned"], typed: ["keyboard", "Typed"] };
  const ALLERGY = {
    allergy: ["chip-alarm", "alert", a => `Allergy: ${a.items.map(i => i.substance).join(", ")}`],
    none: ["chip-ok", "check", () => "No known allergies"],
    unknown: ["chip-caution", "info", () => "Allergies not recorded"],
  };
  // For practice before listening exists (Phase 16). Every one is marked as practice.
  const PRACTICE = [
    { type: "drug", text: "Vancomycin 1 g IV", heard: "giving one gram of vanc" },
    { type: "tourniquet", text: "Tourniquet on, 250 mmHg", heard: "tourniquet up at two fifty" },
    { type: "implant", text: "Femoral component size 5 opened", heard: "open the size five femoral" },
  ];
  const savedRole = () => { try { const r = localStorage.getItem("ot-role-nurse"); return ROLES.includes(r) ? r : ROLES[0] } catch { return ROLES[0] } };
  const keepRole = r => { try { localStorage.setItem("ot-role-nurse", r) } catch {} };
  const pad = n => String(n).padStart(2, "0");
  const clockOf = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  const todayAt = hhmm => { const [h, m] = hhmm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString() };

  function render(view, { api, ui, param, onLeave, isCurrent }) {
    const { el, icon, chip, toast } = ui;
    const head = el("header", "screen-head"), box = el("div");
    const back = el("a", "back"); back.href = "#today"; back.append(icon("back"), "Today's list");
    const h1 = el("h1", null, "Nurse console"); h1.tabIndex = -1;
    box.append(back, h1);
    head.append(box);
    const body = el("div", "nurse-body");
    view.append(head, body);
    return param ? loadCase(param) : loadPicker();

    function message(e) { return e && e.message ? e.message : "Something went wrong. Try again." }
    function button(text, cls, iconName) {
      const b = el("button", `btn ${cls || ""}`.trim()); b.type = "button";
      if (iconName) b.append(icon(iconName));
      b.append(text);
      return b;
    }
    function notice(cls, iconName, title, text, action) {
      const a = el("div", `alert ${cls}`); a.setAttribute("role", "alert");
      const t = el("div", "alert-text"); t.append(el("b", null, title), el("span", null, text));
      a.append(icon(iconName), t);
      if (action) a.append(action);
      return a;
    }

    // ---------- no case chosen: pick one ----------
    async function loadPicker() {
      body.replaceChildren(el("p", "loading", "Loading today's operations…"));
      try {
        const cases = await api.listCases();
        body.replaceChildren(el("p", "lede", cases.length ? "Choose the operation you're working on." : "There are no operations today."));
        if (cases.length) body.append(ui.casePicker(cases, c => `#nurse-${c.id}`));
      } catch (e) {
        const again = button("Try again"); again.addEventListener("click", loadPicker);
        body.replaceChildren(notice("alert-high", "alert", "Today's operations couldn't load", message(e), again));
      }
    }

    async function loadCase(id) {
      body.replaceChildren(el("p", "loading", "Loading the case…"));
      let c;
      try { c = await api.getCase(id) } catch (e) {
        if (!isCurrent()) return;
        if (e && e.code === "not_found") {
          const link = el("a", "btn", "Choose an operation"); link.href = "#nurse";
          body.replaceChildren(notice("alert-medium", "info", "No operation with that ID", "The link may be wrong or out of date.", link));
        } else { const again = button("Try again"); again.addEventListener("click", () => loadCase(id)); body.replaceChildren(notice("alert-high", "alert", "This case couldn't load", message(e), again)) }
        return;
      }
      if (!isCurrent()) return;
      consoleFor(c);
    }

    // ---------- the console ----------
    function consoleFor(c) {
      let events = [];
      const holds = new Map(); // entries being edited or rejected keep their card while the list updates

      // Patient, compact.
      const strip = el("section", "nurse-patient"); strip.setAttribute("aria-label", "Patient");
      const who = el("p", "nurse-who"); who.append(el("b", null, c.patient.name));
      const proc = el("span", "nurse-proc");
      if (c.side) proc.append(el("span", "side", c.side));
      proc.append(c.procedure);
      who.append(proc);
      const [aCls, aIcon, aText] = ALLERGY[c.patient.allergy.state] || ALLERGY.unknown;
      strip.append(who, chip(aCls, aIcon, aText(c.patient.allergy)));
      if (api.source === "sample") strip.append(chip("chip-muted", "info", "Sample data, not saved"));

      // Who is confirming.
      const roleField = el("div", "field nurse-role");
      const roleLabel = el("label", null, "Confirming as"); roleLabel.htmlFor = "nurse-role";
      const role = el("select"); role.id = "nurse-role";
      ROLES.forEach(r => { const o = el("option", null, r); o.value = r; role.append(o) });
      role.value = savedRole();
      role.addEventListener("change", () => keepRole(role.value));
      roleField.append(roleLabel, role);

      const host = el("div", "nurse-panel-host"); // Add entry and Scan label open here

      // Waiting for the nurse.
      const waitSection = el("section", "nurse-section"); waitSection.setAttribute("aria-labelledby", "nurse-wait-h");
      const waitHead = el("div", "nurse-section-head");
      const waitH = el("h2", null, "Waiting for you"); waitH.id = "nurse-wait-h"; waitH.tabIndex = -1;
      const waitCount = el("span", "chip chip-caution nurse-count");
      waitHead.append(waitH, waitCount);
      const waitList = el("ul", "nurse-cards");
      const practice = button("Add practice suggestions", "btn-quiet", "mic");
      practice.addEventListener("click", addPractice);
      waitSection.append(waitHead, waitList, practice);

      // In the record.
      const recSection = el("section", "nurse-section"); recSection.setAttribute("aria-labelledby", "nurse-rec-h");
      const recH = el("h2", null, "In the record"); recH.id = "nurse-rec-h";
      const recList = el("ul", "nurse-rows");
      recSection.append(recH, recList);

      // Rejected, out of the way.
      const rejected = el("details", "nurse-rejected");
      const rejSummary = el("summary");
      const rejList = el("ul", "nurse-rows");
      rejected.append(rejSummary, rejList);

      // Main actions, at the bottom of the phone.
      const bar = el("div", "nurse-bar");
      const addBtn = button("Add entry", "btn-primary btn-lg", "plus");
      const scanBtn = button("Scan label", "btn-lg", "scan");
      addBtn.addEventListener("click", () => openAdd());
      scanBtn.addEventListener("click", openScan);
      bar.append(addBtn, scanBtn);

      body.replaceChildren(strip, roleField, bar, host, waitSection, recSection, rejected);
      onLeave(api.watchEvents(c.id, list => { events = list; draw() }));
      draw();

      // ---------- drawing ----------
      function practiceTag(e) { return e.details && e.details.practice ? chip("chip-muted", null, "Practice") : null }
      function sourceTag(e) { const [ic, word] = SOURCE[e.source] || ["info", e.source]; const s = el("span", "nurse-source"); s.append(icon(ic), word); return s }
      function held(e) { const h = holds.get(e.id); return h && h.status === e.status ? h.el : null }

      function draw() {
        const waiting = events.filter(e => e.status === "suggested");
        const done = events.filter(e => e.status === "confirmed").slice().reverse(); // newest first
        const gone = events.filter(e => e.status === "rejected").slice().reverse();
        waitCount.textContent = String(waiting.length); waitCount.hidden = !waiting.length;
        waitList.replaceChildren(...(waiting.length ? waiting.map(e => held(e) || waitingCard(e)) : [el("li", "nurse-empty", "Nothing waiting. What the assistant hears will appear here for you to confirm.")]));
        recList.replaceChildren(...(done.length ? done.map(e => held(e) || recordRow(e)) : [el("li", "nurse-empty", "Nothing in the record yet.")]));
        rejected.hidden = !gone.length;
        rejSummary.textContent = `Rejected (${gone.length})`;
        rejList.replaceChildren(...gone.map(rejectedRow));
      }

      function cardTop(e) {
        const top = el("div", "nurse-card-top");
        const t = el("time", null, clockOf(e.at)); t.dateTime = e.at;
        top.append(t, el("span", null, TYPE_LABEL[e.type] || e.type), sourceTag(e));
        const p = practiceTag(e); if (p) top.append(p);
        return top;
      }
      // Says exactly what the last edit changed: the text, the time or the kind of entry.
      function editedNote(e) {
        const last = e.history && e.history[e.history.length - 1];
        if (!last) return null;
        const was = [];
        if (last.before.text !== e.text) was.push(`Was: ${last.before.text}`);
        if (last.before.at !== e.at) was.push(`Time was ${clockOf(last.before.at)}`);
        if (last.before.type !== e.type) was.push(`Was a ${(TYPE_LABEL[last.before.type] || last.before.type).toLowerCase()} entry`);
        return el("small", "nurse-edited", [`Edited by ${last.by} at ${clockOf(last.at)}`, ...was].join(". "));
      }

      function waitingCard(e) {
        const li = el("li", "nurse-card"); li.dataset.id = e.id;
        li.append(cardTop(e), el("p", "nurse-text", e.text));
        if (e.heard) li.append(el("p", "nurse-heard", `Heard: “${e.heard}”`));
        const edited = editedNote(e); if (edited) li.append(edited);
        const actions = el("div", "nurse-actions");
        const ok = button("Confirm", "btn-primary btn-lg nurse-confirm", "check");
        const edit = button("Edit", "btn-lg", "edit");
        const no = button("Reject", "btn-lg", "close");
        ok.addEventListener("click", () => decide(e, li, "confirm"));
        edit.addEventListener("click", () => openEdit(e, li));
        no.addEventListener("click", () => askReject(e, li, actions));
        actions.append(ok, edit, no);
        li.append(actions, el("div", "nurse-error"));
        return li;
      }

      function recordRow(e) {
        const li = el("li", "nurse-row"); li.dataset.id = e.id;
        const t = el("time", null, clockOf(e.at)); t.dateTime = e.at;
        const text = el("div", "nurse-row-text");
        text.append(el("b", null, e.text));
        const meta = el("small"); meta.append(sourceTag(e), ` Confirmed by ${e.by} at ${clockOf(e.decidedAt)}`);
        text.append(meta);
        const edited = editedNote(e); if (edited) text.append(edited);
        const p = practiceTag(e); if (p) text.append(p);
        const edit = button("Edit", "", "edit");
        edit.setAttribute("aria-label", `Edit ${e.text}`);
        edit.addEventListener("click", () => openEdit(e, li));
        li.append(t, text, edit, el("div", "nurse-error"));
        return li;
      }

      function rejectedRow(e) {
        const li = el("li", "nurse-row is-rejected");
        const t = el("time", null, clockOf(e.at)); t.dateTime = e.at;
        const text = el("div", "nurse-row-text");
        text.append(el("b", null, e.text), el("small", null, `Rejected by ${e.by} at ${clockOf(e.decidedAt)}${e.reason ? `. Reason: ${e.reason}` : ""}`));
        li.append(t, text);
        return li;
      }

      function showError(card, err) {
        const slot = card.querySelector(".nurse-error");
        if (slot) slot.replaceChildren(notice("alert-high", "alert", "That didn't work", message(err)));
      }
      function focusNext() {
        const next = waitList.querySelector(".nurse-confirm");
        (next || waitH).focus();
      }

      // ---------- decisions ----------
      async function decide(e, card, act, reason) {
        card.querySelectorAll("button, input").forEach(b => { b.disabled = true });
        try {
          if (act === "confirm") { await api.confirmEvent(e.id, { by: role.value }); toast(`Confirmed: ${e.text}`) }
          else { await api.rejectEvent(e.id, { by: role.value, reason }); toast("Rejected. It stays out of the record.") }
          holds.delete(e.id);
          draw();
          setTimeout(focusNext, 0); // after the list has redrawn
        } catch (err) {
          card.querySelectorAll("button, input").forEach(b => { b.disabled = false });
          showError(card, err);
        }
      }

      // Reject takes a second tap, so a slip of the thumb can't throw away a real entry.
      function askReject(e, card, actions) {
        holds.set(e.id, { el: card, status: e.status });
        const form = el("form", "nurse-reject");
        const label = el("label", null, "Reason (optional)"); label.htmlFor = `reject-${e.id}`;
        const reason = el("input"); reason.id = `reject-${e.id}`; reason.type = "text"; reason.autocomplete = "off";
        const field = el("div", "field"); field.append(label, reason);
        const sure = button("Reject entry", "btn-alarm btn-lg"); sure.type = "submit";
        const keep = button("Keep it", "btn-lg");
        const row = el("div", "nurse-actions two"); row.append(sure, keep);
        form.append(el("p", "nurse-ask", "Reject this entry? It stays out of the record."), field, row);
        form.addEventListener("submit", ev => { ev.preventDefault(); decide(e, card, "reject", reason.value.trim() || undefined) });
        keep.addEventListener("click", () => { form.replaceWith(actions); holds.delete(e.id); actions.querySelector("button:last-child").focus() });
        actions.replaceWith(form);
        sure.focus();
      }

      function typeSelect(id, value) {
        const s = el("select"); s.id = id;
        TYPES.forEach(([v, label]) => { const o = el("option", null, label); o.value = v; s.append(o) });
        if (!TYPES.some(([v]) => v === value)) { const o = el("option", null, TYPE_LABEL[value] || value); o.value = value; s.append(o) }
        s.value = value;
        return s;
      }
      function field(labelText, control, help) {
        const f = el("div", "field"); const l = el("label", null, labelText); l.htmlFor = control.id;
        f.append(l, control);
        if (help) { const h = el("span", "help", help); h.id = `${control.id}-help`; control.setAttribute("aria-describedby", h.id); f.append(h) }
        return f;
      }

      function openEdit(e, card) {
        holds.set(e.id, { el: card, status: e.status });
        const form = el("form", "nurse-edit");
        const type = typeSelect(`edit-type-${e.id}`, e.type);
        const text = el("input"); text.id = `edit-text-${e.id}`; text.type = "text"; text.value = e.text; text.autocomplete = "off";
        const time = el("input"); time.id = `edit-time-${e.id}`; time.type = "time"; time.value = clockOf(e.at);
        const save = button("Save changes", "btn-primary btn-lg"); save.type = "submit";
        const cancel = button("Cancel", "btn-lg");
        const row = el("div", "nurse-actions two"); row.append(save, cancel);
        const error = el("div", "nurse-error");
        form.append(el("p", "nurse-ask", `Edit the entry from ${clockOf(e.at)}`), field("What happened", type), field("Details", text), field("Time", time), row, error);
        form.addEventListener("submit", async ev => {
          ev.preventDefault();
          const changes = {};
          if (type.value !== e.type) changes.type = type.value;
          if (text.value.trim() !== e.text) changes.text = text.value;
          if (time.value && time.value !== clockOf(e.at)) changes.at = todayAt(time.value);
          if (!Object.keys(changes).length) { holds.delete(e.id); draw(); return }
          if (!text.value.trim()) { error.replaceChildren(notice("alert-high", "alert", "Add the details", "Describe what happened before saving.")); text.focus(); return }
          save.disabled = true;
          try {
            await api.editEvent(e.id, changes, { by: role.value });
            holds.delete(e.id);
            draw(); // the list may have redrawn before the card was let go
            toast("Saved changes. The earlier version is kept.");
          } catch (err) { save.disabled = false; error.replaceChildren(notice("alert-high", "alert", "Changes weren't saved", message(err))) }
        });
        cancel.addEventListener("click", () => { holds.delete(e.id); draw() });
        card.replaceChildren(form);
        text.focus();
      }

      // ---------- Add entry and Scan label ----------
      function closePanel(focusBack) { host.replaceChildren(); if (focusBack) focusBack.focus() }

      function openAdd(prefill) {
        const form = el("form", "panel nurse-form"); form.setAttribute("aria-labelledby", "nurse-add-h");
        const h2 = el("h2", null, "Add an entry"); h2.id = "nurse-add-h";
        const type = typeSelect("add-type", prefill || "drug");
        const text = el("input"); text.id = "add-text"; text.type = "text"; text.autocomplete = "off";
        text.placeholder = prefill === "implant" ? "For example: Femoral component size 6 opened" : "For example: Vancomycin 1 g IV";
        const opened = clockOf(new Date().toISOString());
        const time = el("input"); time.id = "add-time"; time.type = "time"; time.value = opened;
        const save = button("Add to the record", "btn-primary btn-lg"); save.type = "submit";
        const cancel = button("Cancel", "btn-lg");
        const row = el("div", "nurse-actions two"); row.append(save, cancel);
        const error = el("div", "nurse-error");
        form.append(h2, field("What happened", type), field("Details", text), field("Time", time, "Entries you type go straight into the record, confirmed by you."), row, error);
        form.addEventListener("submit", async ev => {
          ev.preventDefault();
          if (!text.value.trim()) { error.replaceChildren(notice("alert-high", "alert", "Add the details", "Describe what happened before adding it.")); text.focus(); return }
          save.disabled = true;
          try {
            // Left as it was, the time means "now", to the second, so the entry sorts after anything added a moment before.
            const at = !time.value || time.value === opened ? undefined : todayAt(time.value);
            await api.addEvent(c.id, { type: type.value, text: text.value, at, source: "typed", by: role.value });
            toast("Added to the record");
            closePanel(addBtn);
          } catch (err) { save.disabled = false; error.replaceChildren(notice("alert-high", "alert", "That wasn't added", message(err))) }
        });
        cancel.addEventListener("click", () => closePanel(addBtn));
        host.replaceChildren(form);
        form.scrollIntoView({ block: "nearest" });
        type.focus();
      }

      function openScan() {
        const panel = el("section", "panel nurse-form"); panel.setAttribute("aria-labelledby", "nurse-scan-h");
        const h2 = el("h2", null, "Scan a label"); h2.id = "nurse-scan-h"; h2.tabIndex = -1;
        const byHand = button("Add implant by hand", "btn-primary btn-lg", "edit");
        const close = button("Close", "btn-lg");
        const row = el("div", "nurse-actions two"); row.append(byHand, close);
        panel.append(h2, el("p", null, "Reading implant and drug labels with the phone camera comes in Phase 17. Until then, add the implant by hand."), row);
        byHand.addEventListener("click", () => openAdd("implant"));
        close.addEventListener("click", () => closePanel(scanBtn));
        host.replaceChildren(panel);
        panel.scrollIntoView({ block: "nearest" });
        h2.focus();
      }

      async function addPractice() {
        practice.disabled = true;
        try {
          for (const p of PRACTICE) await api.addEvent(c.id, { ...p, source: "voice", details: { practice: true } });
          toast("Added 3 practice suggestions");
        } catch (err) { toast(message(err)) }
        finally { practice.disabled = false }
      }
    }
  }

  OT.screens.nurse = { title: "Nurse console", render };
})(window);
