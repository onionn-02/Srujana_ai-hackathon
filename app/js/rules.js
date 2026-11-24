// Safety rules: plain code, never AI. The endpoint layer runs them; screens only show the results.
// Phase 3 has the drug-allergy check. Phase 13 adds the full drug list, plan-difference checks
// and repeat-dose reminders. The drug families below are a sample for the demo, for the research pair to check.
(function (root) {
  "use strict";
  const OT = (root.OT = root.OT || {});

  const FAMILIES = {
    penicillin:       { label: "penicillin",       drugs: ["penicillin", "amoxicillin", "ampicillin", "flucloxacillin", "piperacillin", "co-amoxiclav"] },
    cephalosporin:    { label: "cephalosporin",    drugs: ["cefazolin", "cefuroxime", "ceftriaxone", "cefalexin", "cephalexin"] },
    glycopeptide:     { label: "glycopeptide",     drugs: ["vancomycin", "teicoplanin"] },
    lincosamide:      { label: "lincosamide",      drugs: ["clindamycin"] },
    aminoglycoside:   { label: "aminoglycoside",   drugs: ["gentamicin"] },
    antifibrinolytic: { label: "antifibrinolytic", drugs: ["tranexamic acid"] },
  };
  // An allergy to one of these families needs a review before giving a drug from the other.
  const CROSS = { penicillin: ["cephalosporin"], cephalosporin: ["penicillin"] };

  function familyOf(name) {
    const n = String(name || "").trim().toLowerCase();
    for (const [id, f] of Object.entries(FAMILIES)) if (f.drugs.includes(n)) return id;
    return null;
  }
  const lower = s => String(s || "").toLowerCase();
  const listOf = names => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  // Checks the planned drugs against the allergy status.
  // Returns warnings, each { level: "high" | "medium" | "advisory", code, title, text, drug? }.
  function checkDrugs(allergy, drugs) {
    const warnings = [];
    if (!drugs || !drugs.length) return warnings;
    if (allergy.state === "unknown") {
      warnings.push({ level: "medium", code: "allergies-unknown", title: "Allergies not recorded", text: `Check allergies before giving ${listOf(drugs.map(d => d.name))}.` });
    }
    for (const d of drugs) {
      const family = familyOf(d.name);
      if (!family) {
        warnings.push({ level: "advisory", code: "drug-not-in-list", drug: d.name, title: `${d.name} isn't in the drug list`, text: "It can't be checked against allergies automatically. Check it by hand." });
        continue;
      }
      for (const a of allergy.items || []) {
        const allergyFamily = familyOf(a.substance);
        if (!allergyFamily) continue;
        const reaction = a.reaction ? lower(a.reaction) : "";
        const severe = /anaphyla/.test(reaction) || a.severity === "severe" || a.criticality === "high";
        if (allergyFamily === family) {
          warnings.push({ level: "high", code: "allergy-same-family", drug: d.name, title: "Allergy clash",
            text: `${d.name} is a ${FAMILIES[family].label}. This patient is allergic to ${lower(a.substance)}${reaction ? ` (${reaction})` : ""}. Don't give it without a review.` });
        } else if ((CROSS[allergyFamily] || []).includes(family)) {
          warnings.push({ level: severe ? "high" : "medium", code: "allergy-cross-reaction", drug: d.name, title: "Allergy clash",
            text: `${d.name} is in the plan. This patient has a ${lower(a.substance)} allergy${reaction ? ` with ${reaction}` : ""}. Review possible cross-reaction before giving it.` });
        }
      }
    }
    return warnings;
  }

  OT.rules = Object.freeze({ checkDrugs, familyOf });
})(typeof window !== "undefined" ? window : globalThis);
