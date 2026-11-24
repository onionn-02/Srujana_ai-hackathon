// Theatre display: the wall screen the whole team reads from 3 metres. Always dark, nothing needs a touch.
// Live view: the patient, allergy, safety warnings, steps, timers, answers and the live record, all from the
// endpoint layer. Timers and step tracking start working in Phase 12, spoken answers in Phase 15.
// "Sample moment" shows a fixed example from the middle of an operation, clearly marked, to check readability.
(function (root) {
  "use strict";
  const OT = (root.OT = root.OT || {});
  OT.screens = OT.screens || {};
  const MAX_RECORD = 7; // the wall shows the latest entries; older ones are counted

  function render(view, { api, ui, param, onLeave, isCurrent }) {
    const { el, icon, chip } = ui;
    const h1 = el("h1", null, "Theatre display"); h1.tabIndex = -1;
    const body = el("div", "wall-body");
    view.append(h1, body);
    return param ? loadCase(param) : loadPicker();

    function message(e) { return e && e.message ? e.message : "Something went wrong." }
    function button(text, onClick) { const b = el("button", "btn", text); b.type = "button"; b.addEventListener("click", onClick); return b }
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
        body.replaceChildren(el("p", "lede", cases.length ? "Choose the operation to show on the wall." : "There are no operations today."));
        if (cases.length) body.append(ui.casePicker(cases, c => `#theatre-${c.id}`));
      } catch (e) {
        body.replaceChildren(notice("alert-high", "alert", "Today's operations couldn't load", message(e), button("Try again", loadPicker)));
      }
    }

    // ---------- one case on the wall ----------
    async function loadCase(id) {
      h1.className = "vh";
      body.replaceChildren(el("p", "loading", "Loading the theatre display…"));
      let c, moment = null;
      try {
        c = await api.getCase(id);
        try { moment = await api.sampleMoment(id) } catch (e) { if (!e || e.code !== "not_found") throw e }
      } catch (e) {
        if (!isCurrent()) return;
        h1.className = "";
        if (e && e.code === "not_found") {
          const link = el("a", "btn", "Choose an operation"); link.href = "#theatre";
          body.replaceChildren(notice("alert-medium", "info", "No operation with that ID", "The link may be wrong or out of date.", link));
        } else body.replaceChildren(notice("alert-high", "alert", "The theatre display couldn't load", message(e), button("Try again", () => loadCase(id))));
        return;
      }
      if (!isCurrent()) return; // the team moved to another screen while this was loading
      h1.textContent = `Theatre display for ${c.patient.name}`;
      body.replaceChildren(wall(c, moment));
    }

    function wall(c, moment) {
      let mode = "live", events = [];
      const root = el("div", "wall");

      // Header: who, what, where, when.
      const head = el("header", "wall-head");
      const who = el("div", "wall-who");
      const proc = el("span", "wall-proc");
      if (c.side) proc.append(el("span", "side", c.side));
      proc.append(c.procedure);
      const blood = c.patient.blood ? `, blood ${c.patient.blood.group}` : "";
      who.append(el("span", "wall-name", c.patient.name), el("span", "wall-facts", `${c.patient.age}, ${c.patient.sex}${blood}`), proc);
      const where = el("div", "wall-where");
      const n = c.readiness.reasons.length;
      const preop = c.readiness.ready ? chip("chip-ok", "check", "Pre-op checks done") : chip("chip-alarm", "alert", `Pre-op blocked: ${n} ${n === 1 ? "item" : "items"}`);
      const sampleTag = chip("chip-caution", "info", "Sample moment, not live"); sampleTag.hidden = true;
      const clock = el("time", "wall-clock");
      where.append(el("span", "wall-theatre", c.theatre), preop, sampleTag, clock);
      let switcher = null;
      if (moment) {
        switcher = el("div", "segmented wall-mode");
        switcher.setAttribute("role", "group"); switcher.setAttribute("aria-label", "What the wall shows");
        for (const [value, text] of [["live", "Live"], ["sample", "Sample moment"]]) {
          const b = el("button", null, text); b.type = "button"; b.dataset.mode = value;
          b.addEventListener("click", () => setMode(value));
          switcher.append(b);
        }
        where.append(switcher);
      }
      head.append(who, where);

      // The allergy band, always visible.
      const a = c.patient.allergy, state = a.state === "allergy" ? "allergy" : a.state === "none" ? "none" : "unknown";
      const allergy = el("div", `wall-allergy is-${state}`);
      const main = state === "allergy" ? `Allergy: ${a.items.map(i => i.substance).join(", ")}` : state === "none" ? "No known allergies" : "Allergies not recorded";
      const extra = state === "allergy" ? a.items.map(i => i.reaction).filter(Boolean).join(", ") : state === "unknown" ? "Ask before giving drugs" : "";
      allergy.append(icon(state === "allergy" ? "alert" : state === "none" ? "check" : "info"), el("strong", null, main));
      if (extra) allergy.append(el("span", null, extra));

      // Safety warnings from the endpoint layer's rules.
      const warnings = el("div", "wall-warnings");
      for (const w of c.warnings) {
        const [cls, iconName] = w.level === "high" ? ["alert-high", "alert"] : w.level === "medium" ? ["alert-medium", "alert"] : ["alert-advisory", "info"];
        const box = el("div", `alert ${cls}`), t = el("div", "alert-text");
        t.append(el("b", null, w.title), el("span", null, w.text));
        box.append(icon(iconName), t);
        warnings.append(box);
      }

      // Steps, timers and answer, live record.
      const steps = el("section", "wall-panel wall-steps"); steps.setAttribute("aria-labelledby", "wall-steps-h");
      const stepsH = el("h2", null, "Steps"); stepsH.id = "wall-steps-h";
      const stepList = el("ol");
      steps.append(stepsH, stepList);
      const centre = el("div", "wall-centre");
      const tiles = el("div", "wall-tiles"); tiles.setAttribute("role", "group"); tiles.setAttribute("aria-label", "Timers");
      const answer = el("div", "wall-answer");
      centre.append(tiles, answer);
      const record = el("section", "wall-panel wall-record"); record.setAttribute("aria-labelledby", "wall-record-h");
      const recordH = el("h2", null, "Live record"); recordH.id = "wall-record-h";
      const earlier = el("p", "wall-earlier"); earlier.hidden = true;
      const recordList = el("ol"); recordList.setAttribute("aria-live", "polite");
      record.append(recordH, earlier, recordList);
      const grid = el("div", "wall-grid");
      grid.append(steps, centre, record);
      const listening = el("div", "wall-listening");
      root.append(head, allergy, warnings, grid, listening);

      function setClock(iso) { clock.textContent = ui.time(iso); clock.dateTime = iso }

      function drawSteps(current) {
        stepList.replaceChildren(...c.plan.steps.map((s, i) => {
          const st = current < 0 || i > current ? "next" : i < current ? "done" : "current";
          const li = el("li", `is-${st}`);
          if (st === "current") li.setAttribute("aria-current", "step");
          li.append(icon(st === "done" ? "check" : st === "current" ? "play" : "circle"), el("span", null, s));
          if (st === "done") li.append(el("span", "vh", " (done)"));
          return li;
        }));
      }

      function drawTiles(list) {
        tiles.replaceChildren(...list.map(t => {
          const box = el("div", `tile${t.caution ? " is-caution" : ""}`);
          const value = el("span", "tile-value");
          if (t.minutes == null) { const dash = el("span", "tile-none", "–"); dash.setAttribute("aria-hidden", "true"); value.append(dash) }
          else value.append(String(t.minutes), el("small", null, "min"));
          box.append(el("span", "tile-label", t.label), value, el("span", "tile-sub", t.note));
          if (t.limit && t.minutes != null) {
            const meter = el("div", "meter");
            meter.setAttribute("role", "img");
            meter.setAttribute("aria-label", `${t.minutes} of ${t.limit} minutes${t.reminders ? `, reminders at ${t.reminders.join(" and ")}` : ""}`);
            const fill = el("i"); fill.style.width = `${Math.min(100, (t.minutes / t.limit) * 100)}%`;
            meter.append(fill);
            for (const r of t.reminders || []) { const mark = el("b"); mark.style.left = `${(r / t.limit) * 100}%`; meter.append(mark) }
            const scale = el("div", "meter-scale"); scale.setAttribute("aria-hidden", "true");
            const marks = [0, ...(t.reminders || []), t.limit];
            marks.forEach((v, i) => { const s = el("span", null, String(v)); if (i > 0 && i < marks.length - 1) s.style.left = `${(v / t.limit) * 100}%`; scale.append(s) });
            box.append(meter, scale);
          }
          return box;
        }));
      }
      const liveTimers = () => [
        c.plan.tourniquet ? { label: "Tourniquet", minutes: null, note: "Not started" } : null,
        { label: "Since incision", minutes: null, note: "Not started" },
        { label: "Anaesthesia", minutes: null, note: "Not started" },
      ].filter(Boolean);
      const sampleTimers = () => moment.timers.map(t => ({
        label: t.label, minutes: t.minutes, note: `${t.noteLabel} ${ui.time(t.startedAt)}`,
        limit: t.limit, reminders: t.reminders, caution: !!(t.reminders && t.minutes >= t.reminders[0]),
      }));

      function drawAnswer(ans) {
        answer.className = `wall-answer ${ans ? "answer" : "is-empty"}`;
        if (!ans) { answer.replaceChildren(el("p", null, "No questions yet.")); return }
        answer.replaceChildren(el("q", null, ans.question), el("p", "answer-text", ans.text), el("p", "answer-source", `Source: ${ans.source.toLowerCase()}`));
      }

      function drawRecord(list) {
        const shown = list.filter(e => e.status !== "rejected"); // rejected entries never join the record
        const recent = shown.slice(-MAX_RECORD), older = shown.length - recent.length;
        earlier.hidden = older === 0;
        earlier.textContent = older ? `${older} earlier ${older === 1 ? "entry" : "entries"} not shown` : "";
        if (!recent.length) { recordList.replaceChildren(el("li", "wall-empty", "No entries yet.")); return }
        recordList.replaceChildren(...recent.map(e => {
          const li = el("li", `wall-event is-${e.status}`);
          const t = el("time", null, ui.time(e.at)); t.dateTime = e.at;
          const text = el("span", "wall-event-text", e.text);
          if (e.details && e.details.practice) text.append(" ", chip("chip-muted", null, "Practice")); // practice entries are always marked
          li.append(t, text, e.status === "confirmed" ? chip("chip-ok", "check", "Confirmed") : chip("chip-caution", "clock", "Suggested"));
          return li;
        }));
      }

      function drawListening(l) {
        const on = l && l.state === "listening";
        listening.className = `wall-listening ${on ? "is-on" : "is-off"}`;
        const dot = el("span", "dot"); dot.setAttribute("aria-hidden", "true");
        listening.replaceChildren(dot, el("b", null, on ? "Listening" : "Microphone off"));
        if (on && l.heard) listening.append(el("q", null, l.heard));
      }

      function setMode(next) {
        mode = next;
        if (switcher) switcher.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
        root.classList.toggle("is-sample", mode === "sample");
        sampleTag.hidden = mode !== "sample";
        warnings.hidden = mode === "sample" || !c.warnings.length;
        if (mode === "sample") {
          setClock(moment.at); drawSteps(moment.currentStep); drawTiles(sampleTimers());
          drawAnswer(moment.answer); drawRecord(moment.record); drawListening(moment.listening);
        } else {
          setClock(new Date().toISOString()); drawSteps(-1); drawTiles(liveTimers());
          drawAnswer(null); drawRecord(events); drawListening({ state: "off" });
        }
      }

      // The live record updates by itself when entries change. Stops when the team leaves this screen.
      onLeave(api.watchEvents(c.id, list => { events = list; if (mode === "live") drawRecord(events) }));
      const clockTimer = setInterval(() => { if (mode === "live") setClock(new Date().toISOString()) }, 15000);
      onLeave(() => clearInterval(clockTimer));
      setMode("live");
      return root;
    }
  }

  OT.screens.theatre = { title: "Theatre display", render };
})(window);
