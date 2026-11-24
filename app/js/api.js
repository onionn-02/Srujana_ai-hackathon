// Endpoint layer: the only way screens read or change data.
// Each function works like a server endpoint (shown beside it) and returns a Promise, so the screens
// already wait for answers the way they will with a real database or a hospital server.
//
// Now (Phase 2): backed by the sample hospital data, kept in this page's memory. Nothing is saved:
// a reload starts fresh, and other devices don't see changes.
// Phase 8 switches the inside of these functions to the shared database. Screens don't change.
// In a real hospital, only this file would change, to talk to the hospital's FHIR/HL7 server.
(function (root) {
  "use strict";
  const OT = (root.OT = root.OT || {});

  class ApiError extends Error {
    constructor(code, message, extra) { super(message); this.name = "ApiError"; this.code = code; Object.assign(this, extra) }
  }
  // Error codes: not_found, invalid, conflict, not_built (arrives in a later phase), unavailable.

  const EVENT_TYPES = ["drug", "tourniquet", "implant", "count", "step", "note", "complication", "plan-difference"];
  const SOURCES = ["voice", "scan", "typed"];
  const NO_KNOWN_ALLERGY = "716186003"; // SNOMED CT

  let db = null;
  const watchers = new Map(); // caseId -> Set of callbacks
  let seq = 0;

  // ---------- helpers ----------
  const copy = v => structuredClone(v);
  const pad = n => String(n).padStart(2, "0");
  const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayAt = hhmm => { const [h, m] = hhmm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString() };
  const nowIso = () => new Date().toISOString();
  const nextId = prefix => `${prefix}${Date.now().toString(36)}${(++seq).toString(36)}`;
  function need(ok, code, message, extra) { if (!ok) throw new ApiError(code, message, extra) }
  function words(value, field, max = 300) {
    need(typeof value === "string" && value.trim() !== "", "invalid", `${field} is required`);
    need(value.trim().length <= max, "invalid", `${field} is too long (over ${max} characters)`);
    return value.trim();
  }
  // A time for the record: now when not given, and never in the future (a minute's leeway for clock drift).
  function isoTime(value, field) {
    if (value == null) return nowIso();
    need(typeof value === "string" && !Number.isNaN(Date.parse(value)), "invalid", `${field} must be a date and time`);
    need(Date.parse(value) <= Date.now() + 60000, "invalid", "The time can't be in the future");
    return new Date(value).toISOString();
  }

  // ---------- reading the hospital record ----------
  function ageOn(birthDate, on = new Date()) {
    const b = new Date(`${birthDate}T00:00:00`);
    let age = on.getFullYear() - b.getFullYear();
    const m = on.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
    return age;
  }

  // Allergy status is always one of three: allergy, none (no known allergies) or unknown (not recorded).
  function allergyStatus(patientId) {
    const list = db.hims.allergies.filter(a => a.patient.reference === `Patient/${patientId}` && a.verificationStatus !== "entered-in-error");
    const isNoneRecord = a => (a.code.coding || []).some(c => c.code === NO_KNOWN_ALLERGY);
    const real = list.filter(a => !isNoneRecord(a));
    if (real.length) {
      const items = real.map(a => ({
        substance: a.code.text,
        reaction: a.reaction?.[0]?.manifestation?.[0]?.text || "",
        severity: a.reaction?.[0]?.severity || "",
        criticality: a.criticality || "",
      }));
      return { state: "allergy", items, summary: items.map(i => i.reaction ? `${i.substance} (${i.reaction.toLowerCase()})` : i.substance).join(", ") };
    }
    if (list.length) return { state: "none", items: [], summary: "No known allergies" };
    return { state: "unknown", items: [], summary: "Allergies not recorded" };
  }

  function patient(patientId, full) {
    const p = db.hims.patients.find(x => x.id === patientId);
    need(p, "not_found", `No patient with id ${patientId}`);
    const n = p.name[0];
    const out = {
      id: p.id, demoId: p.identifier[0].value, name: `${n.given.join(" ")} ${n.family}`,
      sex: p.gender === "female" ? "Female" : p.gender === "male" ? "Male" : "Other",
      age: ageOn(p.birthDate), allergy: allergyStatus(p.id),
    };
    if (full) {
      out.birthDate = p.birthDate;
      out.conditions = db.hims.conditions.filter(c => c.subject.reference === `Patient/${p.id}`).map(c => c.code.text);
      out.blood = db.hims.blood[p.id] || null;
    }
    return out;
  }

  // ---------- cases ----------
  function ensureLoaded() { need(db, "unavailable", "The hospital data didn't load. Reload the page.") }
  function findCase(id) { ensureLoaded(); const c = db.cases.find(x => x.id === id); need(c, "not_found", `No case with id ${id}`); return c }

  // Ready only when the allergy status is known and every required pre-op check is done. Plain code, no AI.
  function readiness(c) {
    const reasons = [];
    if (allergyStatus(c.patientId).state === "unknown") reasons.push({ code: "allergies-not-recorded", text: "Allergies not recorded" });
    for (const item of c.checklist) if (item.required && !item.done) reasons.push({ code: `check-${item.id}`, text: item.missing });
    return { ready: reasons.length === 0, reasons };
  }

  function caseSummary(c) {
    const t = db.templates[c.procedure];
    return {
      id: c.id, date: c.date, start: c.start, theatre: c.theatre,
      procedure: t.name, side: t.sided ? c.side : null,
      surgeon: c.surgeon, anaesthetist: c.anaesthetist,
      patient: patient(c.patientId, false), readiness: readiness(c),
    };
  }

  function build(sample) {
    const date = localDate();
    return {
      date,
      hims: copy(sample.hims),
      templates: copy(sample.templates),
      cases: sample.cases.map(c => ({
        ...copy(c), date, start: todayAt(c.time),
        checklist: c.checklist.map(i => ({ ...copy(i), at: i.at ? todayAt(i.at) : null, history: [] })),
        planHistory: [],
      })),
      events: [],
      notes: {},
      moments: copy(sample.moments || {}),
      operations: copy(sample.sampleOperations || {}),
    };
  }

  // Puts the sample data back to how it started. Used by tests and the demo reset.
  async function reset() {
    need(root.OT_SAMPLE, "unavailable", "The sample hospital data didn't load");
    db = build(root.OT_SAMPLE);
    for (const caseId of watchers.keys()) notify(caseId);
    return { date: db.date, cases: db.cases.length };
  }

  // GET /cases?date=YYYY-MM-DD — the day's operations in time order, with Ready or Blocked for each.
  async function listCases({ date } = {}) {
    ensureLoaded();
    const day = date || localDate();
    need(/^\d{4}-\d{2}-\d{2}$/.test(day), "invalid", "date must look like 2026-11-24");
    return copy(db.cases.filter(c => c.date === day).sort((a, b) => a.start.localeCompare(b.start)).map(caseSummary));
  }

  // GET /cases/:id — one case with the patient's record, the plan, the pre-op checklist and the safety warnings.
  async function getCase(id) {
    const c = findCase(id);
    need(OT.rules, "unavailable", "The safety rules didn't load. Reload the page.");
    const t = db.templates[c.procedure];
    const p = patient(c.patientId, true);
    return copy({
      ...caseSummary(c),
      patient: p,
      plan: { steps: t.steps, tourniquet: c.plan.tourniquet, implants: c.plan.implants, drugs: c.plan.drugs },
      planHistory: c.planHistory,
      checklist: c.checklist.map(({ history, ...item }) => item),
      warnings: OT.rules.checkDrugs(p.allergy, c.plan.drugs), // plain-code safety rules, run here, never on a screen
    });
  }

  // POST /cases/:id/checklist — tick or untick one pre-op check, recording who and when.
  async function tickChecklist(caseId, itemId, { done = true, by } = {}) {
    const c = findCase(caseId);
    const item = c.checklist.find(i => i.id === itemId);
    need(item, "not_found", `No checklist item ${itemId} on case ${caseId}`);
    need(typeof done === "boolean", "invalid", "done must be true or false");
    const who = words(by, "Who ticked it", 80), at = nowIso();
    item.history.push({ done, by: who, at });
    Object.assign(item, { done, by: done ? who : null, at: done ? at : null });
    const { history, ...shown } = item;
    return copy({ item: shown, readiness: readiness(c) });
  }

  // PATCH /cases/:id/plan — change implants, drugs or tourniquet use. Every change is kept with who and why.
  async function updatePlan(caseId, changes, { by, reason } = {}) {
    const c = findCase(caseId);
    need(changes && typeof changes === "object" && Object.keys(changes).length > 0, "invalid", "changes are required");
    const who = words(by, "Who changed the plan", 80);
    const next = copy(c.plan);
    for (const key of Object.keys(changes)) {
      if (key === "implants") {
        need(Array.isArray(changes.implants), "invalid", "implants must be a list");
        next.implants = changes.implants.map(i => ({ part: words(i?.part, "Implant part", 80), size: words(i?.size, "Implant size", 40) }));
      } else if (key === "drugs") {
        need(Array.isArray(changes.drugs), "invalid", "drugs must be a list");
        next.drugs = changes.drugs.map(d => ({ name: words(d?.name, "Drug name", 80), dose: words(d?.dose, "Dose", 40), route: words(d?.route, "Route", 20), when: d?.when ? words(d.when, "When", 120) : "" }));
      } else if (key === "tourniquet") {
        need(typeof changes.tourniquet === "boolean", "invalid", "tourniquet must be true or false");
        next.tourniquet = changes.tourniquet;
      } else need(false, "invalid", `The plan has no field called ${key}`);
    }
    c.planHistory.push({ at: nowIso(), by: who, reason: reason ? words(reason, "Reason", 300) : "", before: copy(c.plan), after: copy(next) });
    c.plan = next;
    return copy(next);
  }

  // ---------- the live record ----------
  function findEvent(id) { ensureLoaded(); const e = db.events.find(x => x.id === id); need(e, "not_found", `No entry with id ${id}`); return e }
  function caseEvents(caseId) { return db.events.filter(e => e.caseId === caseId).sort((a, b) => a.at.localeCompare(b.at)) }
  function notify(caseId) {
    const set = watchers.get(caseId);
    if (!set) return;
    const exists = db.cases.some(c => c.id === caseId);
    for (const fn of set) queueMicrotask(() => fn(exists ? copy(caseEvents(caseId)) : []));
  }

  // GET /cases/:id/events — the record in time order.
  async function listEvents(caseId) { findCase(caseId); return copy(caseEvents(caseId)) }

  // POST /cases/:id/events — what was heard or scanned becomes a suggested entry that a person must confirm.
  // An entry a person types in is theirs, so it is confirmed straight away and needs `by`.
  async function addEvent(caseId, { type, text, at, source, heard, details, by } = {}) {
    findCase(caseId);
    need(EVENT_TYPES.includes(type), "invalid", `type must be one of: ${EVENT_TYPES.join(", ")}`);
    need(SOURCES.includes(source), "invalid", `source must be one of: ${SOURCES.join(", ")}`);
    const event = {
      id: nextId("e"), caseId, type, text: words(text, "Entry text"), at: isoTime(at, "at"), source,
      heard: heard ? words(heard, "What was heard", 500) : "", details: details && typeof details === "object" ? copy(details) : {},
      status: "suggested", by: null, decidedAt: null, history: [],
    };
    if (source === "typed") Object.assign(event, { status: "confirmed", by: words(by, "Who typed it", 80), decidedAt: nowIso() });
    db.events.push(event);
    notify(caseId);
    return copy(event);
  }

  // PATCH /events/:id — confirm a suggested entry. Only then does it join the record.
  async function confirmEvent(id, { by } = {}) {
    const e = findEvent(id);
    need(e.status === "suggested", "conflict", `This entry is already ${e.status}`);
    Object.assign(e, { status: "confirmed", by: words(by, "Who confirmed it", 80), decidedAt: nowIso() });
    notify(e.caseId);
    return copy(e);
  }

  // PATCH /events/:id — reject a suggested entry. It stays visible as rejected but never joins the record.
  async function rejectEvent(id, { by, reason } = {}) {
    const e = findEvent(id);
    need(e.status === "suggested", "conflict", `This entry is already ${e.status}`);
    Object.assign(e, { status: "rejected", by: words(by, "Who rejected it", 80), decidedAt: nowIso(), reason: reason ? words(reason, "Reason") : "" });
    notify(e.caseId);
    return copy(e);
  }

  // PATCH /events/:id — correct an entry. The earlier version is kept, with who changed it and when.
  async function editEvent(id, changes, { by } = {}) {
    const e = findEvent(id);
    need(e.status !== "rejected", "conflict", "A rejected entry can't be edited");
    need(changes && typeof changes === "object", "invalid", "changes are required");
    const who = words(by, "Who edited it", 80);
    const next = {};
    for (const key of Object.keys(changes)) {
      if (key === "text") next.text = words(changes.text, "Entry text");
      else if (key === "at") next.at = isoTime(changes.at, "at");
      else if (key === "type") { need(EVENT_TYPES.includes(changes.type), "invalid", `type must be one of: ${EVENT_TYPES.join(", ")}`); next.type = changes.type }
      else if (key === "details") { need(changes.details && typeof changes.details === "object", "invalid", "details must be an object"); next.details = copy(changes.details) }
      else need(false, "invalid", `An entry has no field called ${key}`);
    }
    e.history.push({ at: nowIso(), by: who, before: { text: e.text, at: e.at, type: e.type, details: copy(e.details) } });
    Object.assign(e, next);
    notify(e.caseId);
    return copy(e);
  }

  // Live GET /cases/:id/events — calls `onChange` now and after every change; returns a function that stops it.
  // Stand-in until Phase 11: changes reach other screens on this page, not other devices.
  function watchEvents(caseId, onChange) {
    findCase(caseId);
    need(typeof onChange === "function", "invalid", "onChange must be a function");
    if (!watchers.has(caseId)) watchers.set(caseId, new Set());
    const set = watchers.get(caseId);
    set.add(onChange);
    queueMicrotask(() => { if (set.has(onChange)) onChange(copy(caseEvents(caseId))) });
    return () => set.delete(onChange);
  }

  // GET /cases/:id/sample-moment — a fixed example from the middle of an operation, for checking the theatre display.
  // It is never mixed with the real record, and every part of it is marked as a sample.
  async function sampleMoment(caseId) {
    const c = findCase(caseId);
    const m = db.moments[caseId];
    need(m, "not_found", "There's no sample moment for this operation");
    const at = todayAt(m.at);
    const minutesSince = hhmm => Math.round((Date.parse(at) - Date.parse(todayAt(hhmm))) / 60000); // time maths in code, never AI
    return copy({
      sample: true, at, currentStep: m.currentStep,
      timers: m.timers.map(({ from, ...t }) => ({ ...t, startedAt: todayAt(from), minutes: minutesSince(from) })),
      record: m.record.map((e, i) => ({ id: `sample-${i + 1}`, caseId: c.id, sample: true, heard: "", details: {}, history: [], decidedAt: null, ...e, at: todayAt(e.at) })),
      answer: m.answer || null,
      listening: m.listening || { state: "off", heard: "" },
    });
  }

  // POST /assistant/ask — answers come from Phase 14. Until then this says so, and never makes up an answer.
  async function ask(caseId, question) {
    findCase(caseId);
    words(question, "Question", 500);
    throw new ApiError("not_built", "Answers to questions arrive in Phase 14.", { phase: 14 });
  }

  // ---------- sample operation ----------
  function sampleEntries(caseId) {
    const list = db.operations[caseId];
    need(list, "not_found", "There's no sample operation for this case");
    return list.map((e, i) => ({
      id: `op-${i + 1}`, caseId, sample: true, status: "confirmed", heard: "", details: {}, history: [], reason: "",
      ...copy(e), at: todayAt(e.at), decidedAt: todayAt(e.at),
    }));
  }
  // GET /cases/:id/sample-operation — a complete fictional record of the operation, for checking the notes screen.
  // It is never mixed with the real record, and every entry is marked as a sample.
  async function sampleRecord(caseId) { findCase(caseId); return copy(sampleEntries(caseId)) }

  // ---------- operation note ----------
  // A sample operation has its own note, kept apart from the real one.
  function noteKey(caseId, sample) {
    if (sample) need(db.operations[caseId], "not_found", "There's no sample operation for this case");
    return sample ? `${caseId}:sample` : caseId;
  }
  function noteOf(caseId, sample) {
    return db.notes[noteKey(caseId, sample)] || { caseId, sample: !!sample, status: "none", text: "", savedAt: null, savedBy: null, signedBy: null, signedAt: null };
  }

  // GET /cases/:id/note/draft — the note written by the template from confirmed entries only (plain code, no AI).
  // Also says how many entries still wait for the nurse, since those aren't in the note.
  async function draftNote(caseId, { sample = false } = {}) {
    const c = findCase(caseId);
    need(OT.noteTemplate, "unavailable", "The note template didn't load. Reload the page.");
    const all = sample ? sampleEntries(caseId) : caseEvents(caseId);
    const summary = { ...caseSummary(c), patient: patient(c.patientId, true) };
    const built = OT.noteTemplate.build(summary, all.filter(e => e.status === "confirmed"));
    return copy({ sample, source: "template", pending: all.filter(e => e.status === "suggested").length, titles: OT.noteTemplate.titles, ...built });
  }

  // GET /cases/:id/note
  async function getNote(caseId, { sample = false } = {}) { findCase(caseId); return copy(noteOf(caseId, sample)) }

  // PUT /cases/:id/note — save a draft. A signed note can't be changed.
  async function saveNote(caseId, text, { by, sample = false } = {}) {
    findCase(caseId);
    const note = noteOf(caseId, sample);
    need(note.status !== "signed", "conflict", "This note is signed and can't be changed");
    db.notes[noteKey(caseId, sample)] = { ...note, status: "draft", text: words(text, "Note", 20000), savedAt: nowIso(), savedBy: words(by, "Who saved it", 80) };
    return copy(db.notes[noteKey(caseId, sample)]);
  }

  // PUT /cases/:id/note/sign — the operating surgeon signs the draft. Signing is final.
  async function signNote(caseId, { by, sample = false } = {}) {
    const c = findCase(caseId);
    const note = noteOf(caseId, sample);
    need(note.status === "draft", note.status === "signed" ? "conflict" : "invalid", note.status === "signed" ? "This note is already signed" : "Save a draft before signing");
    const who = words(by, "Who signed it", 80);
    need(who === c.surgeon, "invalid", `Only the operating surgeon, ${c.surgeon}, can sign this note`);
    db.notes[noteKey(caseId, sample)] = { ...note, status: "signed", signedBy: who, signedAt: nowIso() };
    return copy(db.notes[noteKey(caseId, sample)]);
  }

  OT.ApiError = ApiError;
  OT.api = Object.freeze({
    source: "sample",          // becomes "database" in Phase 8
    liveAcrossDevices: false,  // becomes true in Phase 11
    listCases, getCase, tickChecklist, updatePlan,
    listEvents, addEvent, confirmEvent, rejectEvent, editEvent, watchEvents,
    sampleMoment, sampleRecord, ask, draftNote, getNote, saveNote, signNote, reset,
  });
  if (root.OT_SAMPLE) reset();
})(typeof window !== "undefined" ? window : globalThis);
