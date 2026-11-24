// Phase 2 endpoint checks. Runs the endpoint layer (app/js/api.js) in Node with the sample data.
// No browser needed. Usage: node tests/phase2/api.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const app = join(dirname(fileURLToPath(import.meta.url)), "../../app");
function freshApi() {
  const ctx = { console, structuredClone, queueMicrotask, setTimeout, clearTimeout };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["js/data.js", "js/rules.js", "js/note-template.js", "js/api.js"]) vm.runInContext(readFileSync(join(app, f), "utf8"), ctx, { filename: f });
  return ctx.OT;
}
const tick = () => new Promise(r => setTimeout(r, 0));
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, pass: true }) }
  catch (e) { results.push({ name, pass: false, info: e && e.message || String(e) }) }
}
function ok(cond, message) { if (!cond) throw new Error(message) }
async function rejects(promise, code) {
  try { await promise } catch (e) { ok(e.code === code, `expected error ${code}, got ${e.code}: ${e.message}`); return e }
  throw new Error(`expected error ${code}, but it succeeded`);
}

const { api } = freshApi();

await test("Today's list has 3 operations in time order", async () => {
  const cases = await api.listCases();
  ok(cases.length === 3, `got ${cases.length}`);
  ok(cases.map(c => c.patient.name).join() === "Ravi Kumar,Arjun Rao,Meera Iyer", cases.map(c => c.patient.name).join());
  const times = cases.map(c => new Date(c.start)).map(d => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  ok(times.join() === "08:30,09:00,11:30", times.join());
});

await test("Ready and Blocked follow the checks: Ravi and Arjun blocked, Meera ready", async () => {
  const [ravi, arjun, meera] = await api.listCases();
  ok(!ravi.readiness.ready && ravi.readiness.reasons.map(r => r.text).join("|") === "Crossmatched blood not ready|Antibiotic not checked against allergies", JSON.stringify(ravi.readiness));
  ok(!arjun.readiness.ready && arjun.readiness.reasons.map(r => r.text).join("|") === "Allergies not recorded", JSON.stringify(arjun.readiness));
  ok(meera.readiness.ready && meera.readiness.reasons.length === 0, JSON.stringify(meera.readiness));
});

await test("Allergy status is always one of three: allergy, none, not recorded", async () => {
  const [ravi, arjun, meera] = await api.listCases();
  ok(ravi.patient.allergy.state === "allergy" && ravi.patient.allergy.items[0].substance === "Penicillin" && ravi.patient.allergy.items[0].reaction === "Anaphylaxis", JSON.stringify(ravi.patient.allergy));
  ok(meera.patient.allergy.state === "none" && meera.patient.allergy.summary === "No known allergies", JSON.stringify(meera.patient.allergy));
  ok(arjun.patient.allergy.state === "unknown" && arjun.patient.allergy.summary === "Allergies not recorded", JSON.stringify(arjun.patient.allergy));
});

await test("Ages come from the birth date and sides only show for sided operations", async () => {
  const cases = await api.listCases();
  const expectAge = b => { const d = new Date(), x = new Date(`${b}T00:00:00`); let a = d.getFullYear() - x.getFullYear(); if (d.getMonth() < x.getMonth() || (d.getMonth() === x.getMonth() && d.getDate() < x.getDate())) a--; return a };
  ok(cases[0].patient.age === expectAge("1962-03-14"), `Ravi age ${cases[0].patient.age}`);
  ok(cases[0].side === "LEFT" && cases[2].side === "RIGHT" && cases[1].side === null, cases.map(c => c.side).join());
});

await test("Another day has no operations, and a badly written date is refused", async () => {
  ok((await api.listCases({ date: "2001-01-01" })).length === 0, "expected no cases");
  await rejects(api.listCases({ date: "24/11/2026" }), "invalid");
});

await test("One case comes with the patient record, plan and checklist", async () => {
  const c = await api.getCase("c1");
  ok(c.patient.conditions.includes("Type 2 diabetes") && c.patient.blood.group === "B+", JSON.stringify(c.patient));
  ok(c.plan.implants.length === 3 && c.plan.drugs[0].name === "Cefazolin" && c.plan.steps[0] === "Time Out", JSON.stringify(c.plan));
  ok(c.checklist.length === 9 && c.checklist.every(i => !("history" in i)), "checklist shape");
  await rejects(api.getCase("nope"), "not_found");
});

await test("Answers are copies: changing them doesn't change the stored data", async () => {
  const c = await api.getCase("c1");
  c.patient.allergy.state = "none"; c.plan.implants.length = 0;
  const again = await api.getCase("c1");
  ok(again.patient.allergy.state === "allergy" && again.plan.implants.length === 3, "stored data changed");
});

await test("Ticking a check records who and when, and can make a case ready", async () => {
  await rejects(api.tickChecklist("c1", "crossmatch", {}), "invalid");
  const one = await api.tickChecklist("c1", "crossmatch", { by: "Blood bank" });
  ok(one.item.done && one.item.by === "Blood bank" && one.item.at && !one.readiness.ready, JSON.stringify(one));
  const two = await api.tickChecklist("c1", "antibiotic", { by: "Dr. Kavya Menon" });
  ok(two.readiness.ready, JSON.stringify(two.readiness));
  const three = await api.tickChecklist("c1", "antibiotic", { done: false, by: "Dr. Kavya Menon" });
  ok(!three.readiness.ready && three.item.by === null, JSON.stringify(three));
  await rejects(api.tickChecklist("c1", "nope", { by: "x" }), "not_found");
});

await test("Plan changes are checked and kept with who and why", async () => {
  await rejects(api.updatePlan("c1", { implants: [{ part: "Femoral component", size: "6" }] }, {}), "invalid");
  await rejects(api.updatePlan("c1", { colour: "blue" }, { by: "Dr. Anil Rao" }), "invalid");
  await rejects(api.updatePlan("c1", {}, { by: "Dr. Anil Rao" }), "invalid");
  const plan = await api.updatePlan("c1", { drugs: [{ name: "Vancomycin", dose: "1 g", route: "IV", when: "Before incision" }] }, { by: "Dr. Kavya Menon", reason: "Penicillin allergy" });
  ok(plan.drugs.length === 1 && plan.drugs[0].name === "Vancomycin", JSON.stringify(plan));
  const c = await api.getCase("c1");
  ok(c.planHistory.length === 1 && c.planHistory[0].by === "Dr. Kavya Menon" && c.planHistory[0].before.drugs[0].name === "Cefazolin", JSON.stringify(c.planHistory));
});

await test("Heard and scanned entries start as suggested; typed entries are confirmed by their author", async () => {
  const heard = await api.addEvent("c1", { type: "drug", text: "Vancomycin 1 g IV", source: "voice", heard: "giving one gram of vanc" });
  ok(heard.status === "suggested" && heard.by === null, JSON.stringify(heard));
  const typed = await api.addEvent("c1", { type: "note", text: "Patient in theatre", source: "typed", by: "Circulating nurse" });
  ok(typed.status === "confirmed" && typed.by === "Circulating nurse", JSON.stringify(typed));
  await rejects(api.addEvent("c1", { type: "note", text: "x", source: "typed" }), "invalid");
  await rejects(api.addEvent("c1", { type: "gossip", text: "x", source: "voice" }), "invalid");
  await rejects(api.addEvent("c1", { type: "drug", text: "", source: "voice" }), "invalid");
});

await test("Confirm and Reject work once, and only on suggested entries", async () => {
  const a = await api.addEvent("c1", { type: "tourniquet", text: "Tourniquet on", source: "voice" });
  const confirmed = await api.confirmEvent(a.id, { by: "Circulating nurse" });
  ok(confirmed.status === "confirmed" && confirmed.decidedAt, JSON.stringify(confirmed));
  await rejects(api.confirmEvent(a.id, { by: "Circulating nurse" }), "conflict");
  await rejects(api.rejectEvent(a.id, { by: "Circulating nurse" }), "conflict");
  const b = await api.addEvent("c1", { type: "implant", text: "Femoral component size 5 opened", source: "voice" });
  const rejected = await api.rejectEvent(b.id, { by: "Circulating nurse", reason: "Misheard" });
  ok(rejected.status === "rejected" && rejected.reason === "Misheard", JSON.stringify(rejected));
  await rejects(api.editEvent(b.id, { text: "x" }, { by: "Circulating nurse" }), "conflict");
  await rejects(api.confirmEvent("nope", { by: "x" }), "not_found");
});

await test("Edits keep the earlier version, with who and when", async () => {
  const e = await api.addEvent("c1", { type: "drug", text: "Vancomycin 1 g", source: "voice" });
  const edited = await api.editEvent(e.id, { text: "Vancomycin 1 g IV" }, { by: "Circulating nurse" });
  ok(edited.text === "Vancomycin 1 g IV" && edited.history.length === 1 && edited.history[0].before.text === "Vancomycin 1 g" && edited.history[0].by === "Circulating nurse", JSON.stringify(edited));
  await rejects(api.editEvent(e.id, { status: "confirmed" }, { by: "Circulating nurse" }), "invalid");
});

await test("The record lists entries in time order", async () => {
  const later = await api.addEvent("c3", { type: "step", text: "Closure", source: "voice", at: "2020-01-01T12:00:00Z" });
  const earlier = await api.addEvent("c3", { type: "step", text: "Incision", source: "voice", at: "2020-01-01T10:00:00Z" });
  const list = await api.listEvents("c3");
  ok(list.map(e => e.id).join() === `${earlier.id},${later.id}`, list.map(e => e.text).join());
});

await test("Watching the record gets the list now and after each change, until stopped", async () => {
  const seen = [];
  const stop = api.watchEvents("c2", list => seen.push(list.length));
  await tick();
  await api.addEvent("c2", { type: "step", text: "Ports placed", source: "voice" });
  await tick();
  stop();
  await api.addEvent("c2", { type: "step", text: "Gallbladder removed", source: "voice" });
  await tick();
  ok(seen.join() === "0,1", `saw ${seen.join()}`);
  let threw = null; try { api.watchEvents("nope", () => {}) } catch (e) { threw = e.code }
  ok(threw === "not_found", `got ${threw}`);
});

await test("Questions aren't answered before Phase 14, and nothing is made up", async () => {
  const e = await rejects(api.ask("c1", "Is the patient allergic to anything?"), "not_built");
  ok(e.phase === 14, `phase ${e.phase}`);
  await rejects(api.ask("c1", "  "), "invalid");
});

await test("Operation note: draft, sign, then it can't be changed", async () => {
  ok((await api.getNote("c3")).status === "none", "expected no note");
  await rejects(api.signNote("c3", { by: "Dr. Anil Rao" }), "invalid");
  const draft = await api.saveNote("c3", "Right total hip replacement.", { by: "Dr. Anil Rao" });
  ok(draft.status === "draft" && draft.savedBy === "Dr. Anil Rao", JSON.stringify(draft));
  const signed = await api.signNote("c3", { by: "Dr. Anil Rao" });
  ok(signed.status === "signed" && signed.signedAt, JSON.stringify(signed));
  await rejects(api.saveNote("c3", "Changed.", { by: "Dr. Anil Rao" }), "conflict");
  await rejects(api.signNote("c3", { by: "Dr. Anil Rao" }), "conflict");
});

await test("Reset puts the sample data back", async () => {
  await api.reset();
  const [ravi] = await api.listCases();
  const c = await api.getCase("c1");
  ok(!ravi.readiness.ready && c.plan.drugs[0].name === "Cefazolin" && (await api.listEvents("c1")).length === 0, "not reset");
});

await test("Without the sample data, endpoints say so clearly", async () => {
  const ctx = { console, structuredClone, queueMicrotask, setTimeout, clearTimeout };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readFileSync(join(app, "js/api.js"), "utf8"), ctx);
  await rejects(ctx.OT.api.listCases(), "unavailable");
});

await test("Screens and the app shell never read the sample data directly", async () => {
  const files = ["js/app.js", "js/ui.js", ...readdirSync(join(app, "js/screens")).map(f => `js/screens/${f}`)];
  const offenders = files.filter(f => readFileSync(join(app, f), "utf8").includes("OT_SAMPLE"));
  ok(!offenders.length, offenders.join(", "));
});

await test("Screens never run safety rules or write the note themselves; the endpoint layer does", async () => {
  const files = ["js/app.js", "js/ui.js", ...readdirSync(join(app, "js/screens")).map(f => `js/screens/${f}`)];
  const offenders = files.filter(f => /OT\.rules|OT\.noteTemplate/.test(readFileSync(join(app, f), "utf8")));
  ok(!offenders.length, offenders.join(", "));
});

// ---------- Phase 3: the drug-allergy safety rule ----------
const fresh = freshApi();
const { rules } = fresh;
const pen = (reaction, severity) => ({ state: "allergy", items: [{ substance: "Penicillin", reaction, severity, criticality: severity === "severe" ? "high" : "" }] });

await test("Rule: cefazolin with a penicillin anaphylaxis is a high-priority clash to review", async () => {
  const w = rules.checkDrugs(pen("Anaphylaxis", "severe"), [{ name: "Cefazolin" }]);
  ok(w.length === 1 && w[0].level === "high" && w[0].code === "allergy-cross-reaction" && /Review possible cross-reaction/.test(w[0].text), JSON.stringify(w));
});
await test("Rule: cefazolin with a mild penicillin allergy is a medium-priority review", async () => {
  const w = rules.checkDrugs(pen("Rash", "mild"), [{ name: "Cefazolin" }]);
  ok(w.length === 1 && w[0].level === "medium", JSON.stringify(w));
});
await test("Rule: a drug from the same family as the allergy is a high-priority clash", async () => {
  const w = rules.checkDrugs(pen("Rash", "mild"), [{ name: "Amoxicillin" }]);
  ok(w.length === 1 && w[0].level === "high" && w[0].code === "allergy-same-family", JSON.stringify(w));
});
await test("Rule: vancomycin and tranexamic acid don't clash with a penicillin allergy", async () => {
  ok(rules.checkDrugs(pen("Anaphylaxis", "severe"), [{ name: "Vancomycin" }, { name: "Tranexamic acid" }]).length === 0, "unexpected warning");
});
await test("Rule: no known allergies means no drug warnings", async () => {
  ok(rules.checkDrugs({ state: "none", items: [] }, [{ name: "Cefazolin" }]).length === 0, "unexpected warning");
});
await test("Rule: drugs planned while allergies aren't recorded need a check", async () => {
  const w = rules.checkDrugs({ state: "unknown", items: [] }, [{ name: "Cefazolin" }, { name: "Tranexamic acid" }]);
  ok(w.length === 1 && w[0].level === "medium" && /Cefazolin and Tranexamic acid/.test(w[0].text), JSON.stringify(w));
});
await test("Rule: a drug that isn't in the list is flagged for a check by hand, not passed silently", async () => {
  const w = rules.checkDrugs({ state: "none", items: [] }, [{ name: "Mysteromycin" }]);
  ok(w.length === 1 && w[0].level === "advisory" && w[0].code === "drug-not-in-list", JSON.stringify(w));
});
await test("Ravi's case shows the cefazolin clash; Meera and Arjun have none", async () => {
  const ravi = await fresh.api.getCase("c1"), arjun = await fresh.api.getCase("c2"), meera = await fresh.api.getCase("c3");
  ok(ravi.warnings.length === 1 && ravi.warnings[0].drug === "Cefazolin" && ravi.warnings[0].level === "high", JSON.stringify(ravi.warnings));
  ok(arjun.warnings.length === 0 && meera.warnings.length === 0, JSON.stringify([arjun.warnings, meera.warnings]));
});
// ---------- Phase 6: the operation note ----------
await test("Sample operation: a complete fictional record, kept apart from the real one", async () => {
  const before = (await fresh.api.listEvents("c1")).length;
  const op = await fresh.api.sampleRecord("c1");
  ok(op.length === 14 && op.every(e => e.sample && e.status === "confirmed"), `${op.length} entries`);
  ok((await fresh.api.listEvents("c1")).length === before, "sample entries leaked into the record");
  await rejects(fresh.api.sampleRecord("c2"), "not_found");
});
await test("The template note quotes every confirmed entry, numbered, and nothing else", async () => {
  const d = await fresh.api.draftNote("c1", { sample: true });
  ok(d.source === "template" && d.entries.length === 14 && d.entries[0].n === 1, JSON.stringify({ source: d.source, n: d.entries.length }));
  const refs = d.sections.flatMap(s => s.lines.flatMap(l => l.refs || []));
  ok(refs.every(n => n >= 1 && n <= 14) && new Set(refs).size === 14, `refs ${refs.join(",")}`);
  ok(/^Details\nPatient: Ravi Kumar, \d+, Male, Demo ID 1001\n/.test(d.text) && /Allergies: Penicillin \(anaphylaxis\)/.test(d.text), d.text.slice(0, 200));
});
await test("The note works out the tourniquet time in code: 10:21 to 11:34 is 73 minutes", async () => {
  const d = await fresh.api.draftNote("c1", { sample: true });
  ok(/Total tourniquet time: 73 minutes \[5\]\[11\]/.test(d.text), d.text);
});
await test("The note lists the plan difference with its reason, and says when no complications are recorded", async () => {
  const d = await fresh.api.draftNote("c1", { sample: true });
  ok(/Differences from the plan\n11:12 Femoral component size 6 used; size 5 was planned\. Reason: Better fit at trial \[8\]/.test(d.text), d.text);
  ok(/Complications\nNone recorded\./.test(d.text), "complications line");
});
await test("Only confirmed entries go into the note; waiting ones are counted, rejected ones left out", async () => {
  const api3 = freshApi().api;
  ok(/Nothing in the record yet/.test((await api3.draftNote("c3")).text), "empty note text");
  const a = await api3.addEvent("c3", { type: "drug", text: "Cefazolin 2 g IV", source: "voice" });
  await api3.addEvent("c3", { type: "step", text: "Incision", source: "voice" });
  const r = await api3.addEvent("c3", { type: "note", text: "Wrong patient", source: "voice" });
  await api3.confirmEvent(a.id, { by: "Circulating nurse" });
  await api3.rejectEvent(r.id, { by: "Circulating nurse" });
  const d = await api3.draftNote("c3");
  ok(d.entries.length === 1 && d.pending === 1 && /Cefazolin 2 g IV \[1\]/.test(d.text) && !/Wrong patient/.test(d.text) && !/Incision/.test(d.text), JSON.stringify({ n: d.entries.length, pending: d.pending }));
});
await test("A sample note is saved and signed apart from the real note", async () => {
  await fresh.api.saveNote("c1", "Sample text.", { by: "Dr. Anil Rao", sample: true });
  ok((await fresh.api.getNote("c1")).status === "none" && (await fresh.api.getNote("c1", { sample: true })).status === "draft", "notes mixed");
  await rejects(fresh.api.getNote("c2", { sample: true }), "not_found");
});
await test("Only the operating surgeon can sign the note", async () => {
  await fresh.api.saveNote("c1", "Real draft.", { by: "Dr. Anil Rao" });
  const e = await rejects(fresh.api.signNote("c1", { by: "Circulating nurse" }), "invalid");
  ok(/Only the operating surgeon, Dr\. Anil Rao/.test(e.message), e.message);
  ok((await fresh.api.signNote("c1", { by: "Dr. Anil Rao" })).status === "signed", "surgeon couldn't sign");
});

// ---------- Phase 5: times in the record ----------
await test("An entry can't have a time in the future, when added or edited", async () => {
  const soon = new Date(Date.now() + 10 * 60000).toISOString();
  const e = await rejects(fresh.api.addEvent("c3", { type: "note", text: "Too early", source: "typed", by: "Circulating nurse", at: soon }), "invalid");
  ok(/future/.test(e.message), e.message);
  const ok1 = await fresh.api.addEvent("c3", { type: "note", text: "On time", source: "typed", by: "Circulating nurse" });
  await rejects(fresh.api.editEvent(ok1.id, { at: soon }, { by: "Circulating nurse" }), "invalid");
});

// ---------- Phase 4: the sample moment for the theatre display ----------
await test("Sample moment: Ravi mid-operation, with times worked out in code", async () => {
  const m = await fresh.api.sampleMoment("c1");
  ok(m.sample === true && m.currentStep === 4, JSON.stringify({ sample: m.sample, step: m.currentStep }));
  ok(m.timers.map(t => `${t.id}:${t.minutes}`).join() === "tourniquet:38,incision:31,anaesthesia:52", m.timers.map(t => `${t.id}:${t.minutes}`).join());
  ok(m.record.length === 6 && m.record.every(e => e.sample) && m.record[5].status === "suggested" && m.answer.source === "Surgical plan", JSON.stringify(m.record.map(e => e.status)));
});
await test("Sample moment is never mixed into the real record", async () => {
  const before = (await fresh.api.listEvents("c1")).length;
  await fresh.api.sampleMoment("c1");
  ok((await fresh.api.listEvents("c1")).length === before, "sample entries leaked into the record");
});
await test("Operations without a sample moment say so", async () => {
  await rejects(fresh.api.sampleMoment("c2"), "not_found");
});

await test("Changing Ravi's antibiotic to vancomycin clears the clash", async () => {
  await fresh.api.updatePlan("c1", { drugs: [{ name: "Vancomycin", dose: "1 g", route: "IV" }, { name: "Tranexamic acid", dose: "1 g", route: "IV" }] }, { by: "Dr. Kavya Menon", reason: "Penicillin allergy" });
  ok((await fresh.api.getCase("c1")).warnings.length === 0, "clash still shown");
});

let failed = 0;
for (const r of results) { console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "\n      " + r.info}`); if (!r.pass) failed++ }
console.log(`\n${results.length - failed}/${results.length} endpoint checks passed`);
process.exit(failed ? 1 : 0);
