// Sample hospital data for the demo. Every person here is fictional.
// The hospital-record part follows the FHIR format (Patient, AllergyIntolerance, Condition), so a real
// hospital system could replace it later. Clinical details are examples for the research pair to check.
// Only the endpoint layer (api.js) reads this file. Screens never touch it.
(function (root) {
  "use strict";

  // Pre-op checks. `missing` is what Today's list shows while the check isn't done.
  const CHECKS = {
    consent:    { label: "Consent signed", missing: "Consent not signed" },
    site:       { label: "Operating site marked", missing: "Operating site not marked" },
    bloods:     { label: "Blood tests reviewed", missing: "Blood tests not reviewed" },
    ecg:        { label: "ECG reviewed", missing: "ECG not reviewed" },
    imaging:    { label: "Imaging available", missing: "Imaging not available" },
    fasting:    { label: "Fasting confirmed", missing: "Fasting not confirmed" },
    thinners:   { label: "Blood thinners stopped or not needed", missing: "Blood thinners not checked" },
    crossmatch: { label: "Crossmatched blood ready", missing: "Crossmatched blood not ready" },
    antibiotic: { label: "Antibiotic checked against allergies", missing: "Antibiotic not checked against allergies" },
  };

  // done: [who, "HH:MM"] when ticked, or null when not.
  const check = (id, done) => ({ id, ...CHECKS[id], required: true, done: !!done, by: done ? done[0] : null, at: done ? done[1] : null });

  root.OT_SAMPLE = {
    hims: {
      patients: [
        { resourceType: "Patient", id: "p1001", identifier: [{ system: "urn:demo:mrn", value: "1001" }], name: [{ given: ["Ravi"], family: "Kumar" }], gender: "male", birthDate: "1962-03-14" },
        { resourceType: "Patient", id: "p1002", identifier: [{ system: "urn:demo:mrn", value: "1002" }], name: [{ given: ["Meera"], family: "Iyer" }], gender: "female", birthDate: "1968-07-02" },
        { resourceType: "Patient", id: "p1003", identifier: [{ system: "urn:demo:mrn", value: "1003" }], name: [{ given: ["Arjun"], family: "Rao" }], gender: "male", birthDate: "1985-01-20" },
      ],
      allergies: [
        { resourceType: "AllergyIntolerance", id: "al1", patient: { reference: "Patient/p1001" }, verificationStatus: "confirmed", criticality: "high",
          code: { text: "Penicillin" }, reaction: [{ manifestation: [{ text: "Anaphylaxis" }], severity: "severe" }], recordedDate: "2019-05-11" },
        // SNOMED CT 716186003 is the standard code for "No known allergy".
        { resourceType: "AllergyIntolerance", id: "al2", patient: { reference: "Patient/p1002" }, verificationStatus: "confirmed",
          code: { coding: [{ system: "http://snomed.info/sct", code: "716186003", display: "No known allergy" }], text: "No known allergies" }, recordedDate: "2026-11-20" },
        // Patient p1003 has no allergy record at all, so the status is "not recorded".
      ],
      conditions: [
        { resourceType: "Condition", id: "co1", subject: { reference: "Patient/p1001" }, code: { text: "Osteoarthritis of the left knee" } },
        { resourceType: "Condition", id: "co2", subject: { reference: "Patient/p1001" }, code: { text: "Type 2 diabetes" } },
        { resourceType: "Condition", id: "co3", subject: { reference: "Patient/p1001" }, code: { text: "High blood pressure" } },
        { resourceType: "Condition", id: "co4", subject: { reference: "Patient/p1002" }, code: { text: "Osteoarthritis of the right hip" } },
        { resourceType: "Condition", id: "co5", subject: { reference: "Patient/p1003" }, code: { text: "Gallstones with repeated pain" } },
      ],
      blood: {
        p1001: { group: "B+", unitsRequested: 2, unitsReady: 0 },
        p1002: { group: "O+", unitsRequested: 2, unitsReady: 2 },
        p1003: { group: "A+", unitsRequested: 0, unitsReady: 0 },
      },
    },

    templates: {
      tkr: {
        name: "Total knee replacement", sided: true, tourniquet: true,
        steps: ["Time Out", "Tourniquet on", "Incision", "Exposure of the knee", "Bone cuts", "Trial components", "Cement and implants", "Tourniquet off", "Closure", "Dressing"],
      },
      thr: {
        name: "Total hip replacement", sided: true, tourniquet: false,
        steps: ["Time Out", "Incision", "Exposure of the hip", "Femoral neck cut", "Acetabular reaming", "Cup and liner", "Femoral broaching", "Trial reduction", "Stem and head", "Closure", "Dressing"],
      },
      lapchole: {
        name: "Keyhole gallbladder removal", sided: false, tourniquet: false,
        steps: ["Time Out", "Abdomen inflated", "Ports placed", "Dissection of Calot's triangle", "Critical view of safety", "Cystic duct and artery clipped", "Gallbladder removed", "Ports closed"],
      },
    },

    // A fixed moment in the middle of Ravi Kumar's operation, for checking the theatre display (Phase 4).
    // Kept apart from the real record. Times are today's clock times.
    moments: {
      c1: {
        at: "10:59",
        currentStep: 4,
        timers: [
          { id: "tourniquet", label: "Tourniquet", from: "10:21", noteLabel: "On since", reminders: [60, 90], limit: 120 },
          { id: "incision", label: "Since incision", from: "10:28", noteLabel: "Incision at" },
          { id: "anaesthesia", label: "Anaesthesia", from: "10:07", noteLabel: "Started at" },
        ],
        record: [
          { at: "09:40", type: "drug", text: "Vancomycin 1 g IV", source: "voice", status: "confirmed", by: "Circulating nurse" },
          { at: "10:07", type: "step", text: "Anaesthesia started", source: "typed", status: "confirmed", by: "Dr. Kavya Menon" },
          { at: "10:15", type: "step", text: "Time Out completed", source: "voice", status: "confirmed", by: "Circulating nurse" },
          { at: "10:21", type: "tourniquet", text: "Tourniquet on, 250 mmHg", source: "voice", status: "confirmed", by: "Circulating nurse" },
          { at: "10:28", type: "step", text: "Incision", source: "voice", status: "confirmed", by: "Circulating nurse" },
          { at: "10:58", type: "implant", text: "Femoral component size 5 opened", source: "voice", heard: "open the size five femoral", status: "suggested", by: null },
        ],
        answer: { question: "Which implant size did we plan?", text: "Femoral 5, tibial 4, insert 10 mm", source: "Surgical plan" },
        listening: { state: "listening", heard: "okay, open the size five femoral" },
      },
    },

    // A complete fictional record of Ravi Kumar's operation, for checking the operation notes screen (Phase 6).
    // Kept apart from the real record. Times are today's clock times.
    sampleOperations: {
      c1: [
        { at: "09:40", type: "drug", text: "Vancomycin 1 g IV", source: "voice", by: "Circulating nurse" },
        { at: "10:07", type: "step", text: "Anaesthesia started", source: "typed", by: "Dr. Kavya Menon" },
        { at: "10:15", type: "step", text: "Time Out completed", source: "voice", by: "Circulating nurse" },
        { at: "10:18", type: "drug", text: "Tranexamic acid 1 g IV", source: "voice", by: "Circulating nurse" },
        { at: "10:21", type: "tourniquet", text: "Tourniquet on, 250 mmHg", source: "voice", by: "Circulating nurse", details: { action: "on" } },
        { at: "10:28", type: "step", text: "Incision", source: "voice", by: "Circulating nurse" },
        { at: "11:12", type: "implant", text: "Femoral component size 6 implanted", source: "voice", by: "Scrub nurse" },
        { at: "11:12", type: "plan-difference", text: "Femoral component size 6 used; size 5 was planned", source: "voice", by: "Dr. Anil Rao", details: { reason: "Better fit at trial" } },
        { at: "11:15", type: "implant", text: "Tibial component size 4 implanted", source: "voice", by: "Scrub nurse" },
        { at: "11:18", type: "implant", text: "Insert 10 mm placed", source: "voice", by: "Scrub nurse" },
        { at: "11:34", type: "tourniquet", text: "Tourniquet off", source: "voice", by: "Circulating nurse", details: { action: "off" } },
        { at: "11:45", type: "count", text: "Swab and instrument counts correct", source: "voice", by: "Scrub nurse" },
        { at: "11:52", type: "step", text: "Closure", source: "voice", by: "Circulating nurse" },
        { at: "11:58", type: "step", text: "Dressing applied", source: "typed", by: "Circulating nurse" },
      ],
    },

    cases: [
      {
        id: "c1", patientId: "p1001", procedure: "tkr", side: "LEFT", time: "08:30", theatre: "OT 1",
        surgeon: "Dr. Anil Rao", anaesthetist: "Dr. Kavya Menon",
        plan: {
          implants: [{ part: "Femoral component", size: "5" }, { part: "Tibial component", size: "4" }, { part: "Insert", size: "10 mm" }],
          drugs: [{ name: "Cefazolin", dose: "2 g", route: "IV", when: "Within 60 minutes before incision" }, { name: "Tranexamic acid", dose: "1 g", route: "IV", when: "Before incision" }],
          tourniquet: true,
        },
        checklist: [
          check("consent", ["Ward nurse", "07:10"]), check("site", ["Dr. Anil Rao", "07:25"]), check("bloods", ["Dr. Kavya Menon", "07:30"]),
          check("ecg", ["Dr. Kavya Menon", "07:30"]), check("imaging", ["Ward nurse", "07:12"]), check("fasting", ["Ward nurse", "07:10"]),
          check("thinners", ["Dr. Kavya Menon", "07:31"]), check("crossmatch", null), check("antibiotic", null),
        ],
      },
      {
        id: "c2", patientId: "p1003", procedure: "lapchole", side: null, time: "09:00", theatre: "OT 2",
        surgeon: "Dr. Farah Siddiqui", anaesthetist: "Dr. Vikram Shah",
        plan: { implants: [], drugs: [], tourniquet: false },
        checklist: [
          check("consent", ["Ward nurse", "07:40"]), check("bloods", ["Dr. Vikram Shah", "07:55"]), check("ecg", ["Dr. Vikram Shah", "07:55"]),
          check("imaging", ["Ward nurse", "07:41"]), check("fasting", ["Ward nurse", "07:40"]), check("thinners", ["Dr. Vikram Shah", "07:56"]),
        ],
      },
      {
        id: "c3", patientId: "p1002", procedure: "thr", side: "RIGHT", time: "11:30", theatre: "OT 1",
        surgeon: "Dr. Anil Rao", anaesthetist: "Dr. Kavya Menon",
        plan: {
          implants: [{ part: "Acetabular cup", size: "52 mm" }, { part: "Liner", size: "32 mm" }, { part: "Femoral stem", size: "12" }, { part: "Femoral head", size: "32 mm" }],
          drugs: [{ name: "Cefazolin", dose: "2 g", route: "IV", when: "Within 60 minutes before incision" }, { name: "Tranexamic acid", dose: "1 g", route: "IV", when: "Before incision" }],
          tourniquet: false,
        },
        checklist: [
          check("consent", ["Ward nurse", "08:05"]), check("site", ["Dr. Anil Rao", "08:20"]), check("bloods", ["Dr. Kavya Menon", "08:15"]),
          check("ecg", ["Dr. Kavya Menon", "08:15"]), check("imaging", ["Ward nurse", "08:06"]), check("fasting", ["Ward nurse", "08:05"]),
          check("thinners", ["Dr. Kavya Menon", "08:16"]), check("crossmatch", ["Blood bank", "08:40"]), check("antibiotic", ["Dr. Kavya Menon", "08:17"]),
        ],
      },
    ],
  };
})(typeof window !== "undefined" ? window : globalThis);
