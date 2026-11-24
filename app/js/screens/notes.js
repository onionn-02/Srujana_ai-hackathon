// Operation notes: the note for one operation, beside the confirmed entries it was written from.
// Phase 6: a template (plain code, no AI) writes the draft from confirmed entries only; the AI draft comes in Phase 19.
// Edit, Sign (final, after a second tap, surgeon only) and Save PDF all work. "Sample operation" shows a complete
// fictional record, clearly marked, with its own note. Data comes only through the endpoint layer (OT.api).
(function (root) {
  "use strict";
  const OT = (root.OT = root.OT || {});
  OT.screens = OT.screens || {};

  const JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  const TYPE_LABEL = { drug: "Drug given", tourniquet: "Tourniquet", implant: "Implant", count: "Count", step: "Step", complication: "Complication", note: "Note", "plan-difference": "Plan difference" };
  const ALLERGY = {
    allergy: ["chip-alarm", "alert", a => `Allergy: ${a.items.map(i => i.substance).join(", ")}`],
    none: ["chip-ok", "check", () => "No known allergies"],
    unknown: ["chip-caution", "info", () => "Allergies not recorded"],
  };
  const pad = n => String(n).padStart(2, "0");
  const isoDate = iso => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };

  function render(view, { api, ui, param, onLeave, isCurrent }) {
    const { el, icon, chip, toast } = ui;
    const head = el("header", "screen-head"), box = el("div");
    const back = el("a", "back"); back.href = "#today"; back.append(icon("back"), "Today's list");
    const h1 = el("h1", null, "Operation notes"); h1.tabIndex = -1;
    box.append(back, h1);
    head.append(box);
    const body = el("div", "notes-body");
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
        body.replaceChildren(el("p", "lede", cases.length ? "Choose the operation to write up." : "There are no operations today."));
        if (cases.length) body.append(ui.casePicker(cases, c => `#notes-${c.id}`));
      } catch (e) {
        const again = button("Try again"); again.addEventListener("click", loadPicker);
        body.replaceChildren(notice("alert-high", "alert", "Today's operations couldn't load", message(e), again));
      }
    }

    async function loadCase(id) {
      body.replaceChildren(el("p", "loading", "Loading the note…"));
      let c, hasSample = false;
      try {
        c = await api.getCase(id);
        try { await api.sampleRecord(id); hasSample = true } catch (e) { if (!e || e.code !== "not_found") throw e }
      } catch (e) {
        if (!isCurrent()) return;
        if (e && e.code === "not_found") {
          const link = el("a", "btn", "Choose an operation"); link.href = "#notes";
          body.replaceChildren(notice("alert-medium", "info", "No operation with that ID", "The link may be wrong or out of date.", link));
        } else { const again = button("Try again"); again.addEventListener("click", () => loadCase(id)); body.replaceChildren(notice("alert-high", "alert", "The note couldn't load", message(e), again)) }
        return;
      }
      if (!isCurrent()) return;
      notesFor(c, hasSample);
    }

    // ---------- the notes screen for one case ----------
    function notesFor(c, hasSample) {
      let sample = false, draft = null, note = null, mode = "read"; // mode: read | edit | sign
      const signer = c.surgeon;

      // Patient and the view switch.
      const top = el("div", "notes-top");
      const who = el("p", "nurse-who"); who.append(el("b", null, c.patient.name));
      const proc = el("span", "nurse-proc");
      if (c.side) proc.append(el("span", "side", c.side));
      proc.append(c.procedure);
      who.append(proc);
      const [aCls, aIcon, aText] = ALLERGY[c.patient.allergy.state] || ALLERGY.unknown;
      top.append(who, chip(aCls, aIcon, aText(c.patient.allergy)));
      if (api.source === "sample") top.append(chip("chip-muted", "info", "Sample data, not saved"));
      let switcher = null;
      if (hasSample) {
        switcher = el("div", "segmented notes-mode"); switcher.setAttribute("role", "group"); switcher.setAttribute("aria-label", "Which record to write up");
        for (const [value, text] of [["record", "Record"], ["sample", "Sample operation"]]) {
          const b = el("button", null, text); b.type = "button"; b.dataset.mode = value;
          b.setAttribute("aria-pressed", String(value === "record"));
          b.addEventListener("click", () => { sample = value === "sample"; mode = "read"; switcher.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); refresh() });
          switcher.append(b);
        }
        top.append(switcher);
      }
      const sampleTag = chip("chip-caution", "info", "Sample operation with a fictional record"); sampleTag.hidden = true;
      top.append(sampleTag);

      const paper = el("section", "panel note-paper"); paper.setAttribute("aria-labelledby", "note-h");
      const timeline = el("section", "panel note-timeline"); timeline.setAttribute("aria-labelledby", "timeline-h");
      const grid = el("div", "notes-grid"); grid.append(paper, timeline);
      body.replaceChildren(top, grid);

      async function refresh() {
        try {
          const [d, n] = await Promise.all([api.draftNote(c.id, { sample }), api.getNote(c.id, { sample })]);
          if (!isCurrent()) return;
          draft = d; note = n; draw();
        } catch (e) { if (isCurrent()) paper.replaceChildren(notice("alert-high", "alert", "The note couldn't load", message(e))) }
      }
      // The draft follows the record as entries are confirmed, until it is saved or someone is editing it.
      let first = true;
      onLeave(api.watchEvents(c.id, () => { if (first) { first = false; return } if (!sample && mode === "read") refresh() }));
      refresh();

      // ---------- drawing ----------
      function refButton(n) {
        const b = el("button", "ref", String(n)); b.type = "button";
        b.setAttribute("aria-label", `Show entry ${n}`);
        b.addEventListener("click", () => showEntry(n));
        return b;
      }
      function showEntry(n) {
        const item = timeline.querySelector(`[data-n="${n}"]`);
        if (!item) return;
        timeline.querySelectorAll(".is-flash").forEach(x => x.classList.remove("is-flash"));
        item.classList.add("is-flash");
        item.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        item.focus({ preventScroll: true });
      }
      // Saved text: each [n] becomes a button that shows its entry.
      function savedText(text) {
        const wrap = el("div", "note-text");
        for (const line of text.split("\n")) {
          if (draft.titles.includes(line.trim())) { wrap.append(el("h3", null, line.trim())); continue }
          const p = el("p");
          if (!line.trim()) { p.className = "note-gap"; wrap.append(p); continue }
          let last = 0;
          for (const m of line.matchAll(/\[(\d+)\]/g)) { p.append(line.slice(last, m.index)); p.append(refButton(Number(m[1]))); last = m.index + m[0].length }
          p.append(line.slice(last));
          wrap.append(p);
        }
        return wrap;
      }
      function templateText(d) {
        const wrap = el("div", "note-text");
        for (const s of d.sections) {
          const sec = el("section", "note-section");
          sec.append(el("h3", null, s.title));
          const list = el("ul");
          for (const line of s.lines) { const li = el("li", null, line.text); (line.refs || []).forEach(n => li.append(refButton(n))); list.append(li) }
          sec.append(list);
          wrap.append(sec);
        }
        return wrap;
      }

      function draw() {
        sampleTag.hidden = !sample;
        const signed = note.status === "signed";
        const h2 = el("h2", null, "Operation note"); h2.id = "note-h";
        const status = signed ? chip("chip-ok", "check", "Signed") : note.status === "draft" ? chip("chip-caution", "edit", "Saved draft") : chip("chip-muted", "note", "Draft from the record");
        const titleRow = el("div", "panel-head"); titleRow.append(h2, status);
        const source = el("p", "note-source", note.status === "none"
          ? "Written from the confirmed entries by a template, not by AI. Each line points to its entry. The AI draft comes in Phase 19."
          : `Saved by ${note.savedBy} at ${ui.time(note.savedAt)}.`);
        const parts = [titleRow, source];
        if (draft.pending && !signed) parts.push(notice("alert-medium", "clock", `${draft.pending} ${draft.pending === 1 ? "entry waits" : "entries wait"} for the nurse`, "Only confirmed entries go into the note."));

        if (mode === "edit") parts.push(editor());
        else parts.push(note.status === "none" ? templateText(draft) : savedText(note.text));

        if (signed) {
          const done = el("div", "note-signed");
          done.append(icon("check"), el("p", null, `Signed by ${note.signedBy} at ${ui.time(note.signedAt)}. Signed notes can't be changed.`));
          parts.push(done);
        } else if (mode === "sign") parts.push(signBox());

        if (mode === "read") {
          const actions = el("div", "note-actions");
          if (!signed) {
            const edit = button("Edit", "btn-lg", "edit"); edit.addEventListener("click", () => { mode = "edit"; draw(); paper.querySelector("textarea").focus() });
            const sign = button("Sign note", "btn-primary btn-lg", "check");
            if (!draft.entries.length && note.status === "none") { sign.disabled = true; sign.setAttribute("aria-describedby", "sign-why") }
            sign.addEventListener("click", () => { mode = "sign"; draw(); paper.querySelector(".note-sign .btn-primary").focus() });
            actions.append(edit, sign);
          }
          const pdf = button("Save PDF", "btn-lg", "note"); pdf.addEventListener("click", () => savePdf(pdf));
          actions.append(pdf);
          parts.push(actions);
          if (!signed) {
            const why = el("p", "panel-note", !draft.entries.length && note.status === "none" ? "Nothing to sign yet: no entries are confirmed." : `Signing as ${signer}, the operating surgeon.`);
            why.id = "sign-why";
            parts.push(why);
          }
        }
        const error = el("div", "note-error"); error.setAttribute("aria-live", "polite");
        parts.push(error);
        paper.replaceChildren(...parts);
        drawTimeline();
      }

      function drawTimeline() {
        const h2 = el("h2", null, sample ? "Entries in the sample operation" : "Confirmed entries"); h2.id = "timeline-h";
        const list = el("ol", "note-entries");
        if (!draft.entries.length) list.append(el("li", "nurse-empty", "No confirmed entries yet. The nurse confirms them on the nurse console."));
        for (const e of draft.entries) {
          const li = el("li", "note-entry"); li.dataset.n = String(e.n); li.tabIndex = -1;
          const t = el("time", null, ui.time(e.at)); t.dateTime = e.at;
          li.append(el("span", "num", String(e.n)), t, el("span", "note-entry-text", e.text));
          li.append(el("small", null, `${TYPE_LABEL[e.type] || e.type}. Confirmed by ${e.by}${e.sample ? " (sample)" : ""}`));
          list.append(li);
        }
        timeline.replaceChildren(h2, list);
      }

      function editor() {
        const form = el("form", "note-edit");
        const label = el("label", null, "Note text"); label.htmlFor = "note-text";
        const area = el("textarea"); area.id = "note-text"; area.value = note.status === "none" ? draft.text : note.text;
        area.setAttribute("aria-describedby", "note-text-help");
        const help = el("p", "panel-note", "Keep the numbers in square brackets, like [3]: they link each fact to its entry."); help.id = "note-text-help";
        const save = button("Save draft", "btn-primary btn-lg"); save.type = "submit";
        const cancel = button("Cancel", "btn-lg");
        const again = button("Start again from the record", "btn-quiet");
        const row = el("div", "note-actions"); row.append(save, cancel, again);
        form.append(label, area, help, row);
        form.addEventListener("submit", async ev => {
          ev.preventDefault();
          save.disabled = true;
          try {
            note = await api.saveNote(c.id, area.value, { by: signer, sample });
            mode = "read"; toast("Draft saved"); await refresh();
          } catch (e) { save.disabled = false; showError("The draft wasn't saved", e) }
        });
        cancel.addEventListener("click", () => { mode = "read"; draw() });
        again.addEventListener("click", () => { area.value = draft.text; area.focus() });
        return form;
      }

      // Signing is final, so it takes a second tap.
      function signBox() {
        const box = el("div", "note-sign");
        box.append(el("p", null, `Sign this note as ${signer}? Signed notes can't be changed.`));
        const yes = button("Sign note", "btn-primary btn-lg", "check");
        const no = button("Not yet", "btn-lg");
        const row = el("div", "note-actions"); row.append(yes, no);
        box.append(row);
        yes.addEventListener("click", async () => {
          yes.disabled = true;
          try {
            if (note.status === "none") await api.saveNote(c.id, draft.text, { by: signer, sample });
            note = await api.signNote(c.id, { by: signer, sample });
            mode = "read"; toast("Note signed"); await refresh();
          } catch (e) { yes.disabled = false; showError("The note wasn't signed", e) }
        });
        no.addEventListener("click", () => { mode = "read"; draw() });
        return box;
      }

      function showError(title, e) { const slot = paper.querySelector(".note-error"); if (slot) slot.replaceChildren(notice("alert-high", "alert", title, message(e))) }

      // ---------- PDF ----------
      async function savePdf(btn) {
        btn.disabled = true;
        try {
          const saver = await ui.downloads();
          if (!saver) throw new Error("Saving files works when the app is open in claude.ai.");
          const jspdf = await ui.loadScript(JSPDF, "jspdf");
          const data = pdfOf(jspdf.jsPDF);
          const filename = `operation-note-${c.patient.demoId}-${isoDate(c.start)}${sample ? "-sample" : ""}.pdf`;
          const r = await saver.save({ filename, data });
          toast(r && r.status === "delivered" ? `${filename} is ready to save` : `Saved ${filename}`);
        } catch (e) {
          showError("The PDF wasn't saved", e && e.code === "declined" ? { message: "Saving was cancelled." } : e);
        } finally { btn.disabled = false }
      }

      function pdfOf(jsPDF) {
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const left = 56, width = 595 - 2 * left, bottom = 842 - 64;
        let y = 64;
        const write = (text, size, opts = {}) => {
          doc.setFont("helvetica", opts.bold ? "bold" : "normal"); doc.setFontSize(size);
          if (opts.color) doc.setTextColor(...opts.color); else doc.setTextColor(19, 35, 32);
          for (const line of doc.splitTextToSize(text, width)) {
            if (y > bottom) { doc.addPage(); y = 64 }
            doc.text(line, left, y); y += size * 1.4;
          }
        };
        write("Operation note", 20, { bold: true });
        if (sample) write("SAMPLE OPERATION. Fictional patient and record.", 11, { bold: true, color: [168, 31, 31] });
        write(note.status === "signed" ? `Signed by ${note.signedBy} at ${ui.time(note.signedAt)}` : "DRAFT. Not signed.", 11, { bold: true, color: note.status === "signed" ? [29, 107, 95] : [122, 83, 0] });
        y += 8;
        const text = note.status === "none" ? draft.text : note.text;
        for (const line of text.split("\n")) {
          if (!line.trim()) { y += 6; continue }
          const title = draft.titles.includes(line.trim());
          write(line, title ? 13 : 11, { bold: title });
        }
        y += 10;
        write("Record entries", 13, { bold: true });
        for (const e of draft.entries) write(`[${e.n}] ${ui.time(e.at)} ${e.text}. ${TYPE_LABEL[e.type] || e.type}, confirmed by ${e.by}.`, 10);
        const pages = doc.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
          doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(86, 103, 99);
          doc.text(`Educational prototype with fictional patients. Not for clinical use. Page ${i} of ${pages}`, left, 842 - 32);
        }
        return doc.output("blob");
      }
    }
  }

  OT.screens.notes = { title: "Operation notes", render };
})(window);
