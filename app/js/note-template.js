// Writes the operation note from confirmed entries. Plain code, no AI: every line quotes an entry and points to it
// by number, so nothing goes into the note that isn't in the record. Times are worked out in code.
// The endpoint layer runs this; screens only show the result. Phase 19 adds an AI draft, checked against the record.
(function (root) {
  "use strict";
  const OT = (root.OT = root.OT || {});

  const pad = n => String(n).padStart(2, "0");
  const clock = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  const longDate = iso => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const GROUPS = [
    ["drug", "Drugs given"], ["tourniquet", "Tourniquet"], ["step", "Steps"], ["implant", "Implants"],
    ["plan-difference", "Differences from the plan"], ["count", "Counts"], ["complication", "Complications"], ["note", "Other notes"],
  ];
  const ON = /\b(on|up|inflated)\b/i, OFF = /\b(off|down|deflated|released)\b/i;
  const tourniquetAction = e => (e.details && e.details.action) || (OFF.test(e.text) ? "off" : ON.test(e.text) ? "on" : "");

  // c: the case summary with its patient. confirmed: the confirmed entries only.
  // Returns { entries (numbered in time order), sections [{ title, lines [{ text, refs }] }], text }.
  function build(c, confirmed) {
    const entries = confirmed.slice().sort((a, b) => a.at.localeCompare(b.at)).map((e, i) => ({ ...e, n: i + 1 }));
    const p = c.patient;
    const sections = [{
      title: "Details",
      lines: [
        { text: `Patient: ${p.name}, ${p.age}, ${p.sex}, Demo ID ${p.demoId}` },
        { text: `Date: ${longDate(c.start)}` },
        { text: `Operation: ${c.side ? `${c.side} ${c.procedure.toLowerCase()}` : c.procedure}` },
        { text: `Surgeon: ${c.surgeon}` },
        { text: `Anaesthetist: ${c.anaesthetist}` },
        { text: `Theatre: ${c.theatre}` },
        { text: `Allergies: ${p.allergy.summary}` },
      ],
    }];
    if (!entries.length) sections.push({ title: "Record", lines: [{ text: "Nothing in the record yet. The note fills in as entries are confirmed." }] });
    for (const [type, title] of GROUPS) {
      const list = entries.filter(e => e.type === type);
      const lines = list.map(e => ({ text: `${clock(e.at)} ${e.text}${e.details && e.details.reason ? `. Reason: ${e.details.reason}` : ""}`, refs: [e.n] }));
      if (type === "tourniquet" && list.length) {
        const on = list.find(e => tourniquetAction(e) === "on");
        const off = on && list.find(e => tourniquetAction(e) === "off" && e.at >= on.at);
        if (on && off) lines.push({ text: `Total tourniquet time: ${Math.round((Date.parse(off.at) - Date.parse(on.at)) / 60000)} minutes`, refs: [on.n, off.n] });
        else if (on) lines.push({ text: "The tourniquet off time isn't in the record yet.", refs: [on.n] });
      }
      if (type === "complication" && entries.length && !list.length) lines.push({ text: "None recorded.", refs: [] });
      if (lines.length) sections.push({ title, lines });
    }
    const text = sections
      .map(s => [s.title, ...s.lines.map(l => l.text + (l.refs && l.refs.length ? ` ${l.refs.map(n => `[${n}]`).join("")}` : ""))].join("\n"))
      .join("\n\n");
    return { entries, sections, text };
  }

  OT.noteTemplate = Object.freeze({ build, titles: ["Details", "Record", ...GROUPS.map(g => g[1])] });
})(typeof window !== "undefined" ? window : globalThis);
