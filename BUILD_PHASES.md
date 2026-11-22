# OT Assistant: Build Phases (what Claude builds)

This is the **building order only**. Phase numbers match [PHASES.md](PHASES.md), which has the team's tests and tasks. The idea is in [PLAN.md](PLAN.md).

**Status: not started.**

## How we build

1. The team says **"start phase 1"**.
2. Claude builds **only that phase** and tests it.
3. Claude gives the link and a short list of what to try.
4. The team says **"pass"** or lists problems. Claude fixes them.
5. Claude saves a version. The team says **"start phase 2"**, and so on.

**Never two phases at once. Every phase ends with something you can open and click.**

## The order in one picture

```
1 Test the risky parts
        ↓
2 Look and empty screens
        ↓
3 Before surgery ──→ 4 Live theatre by hand
                              ↓
                     5 AI answers questions
                              ↓
                     6 AI listens            ← core demo
                              ↓
              7 Label photo and reminders
                              ↓
                     8 Operation note        ← full demo
                              ↓
                     9 Backups and accuracy  ← feature freeze
                              ↓
                    10 Polish
```

If 7 runs late, 8 can be built first. It needs only phases 3–6.

## Planned files

Names may change a little while building.

```
D:\srujana\
  app\
    index.html        the page itself
    styles.css        colours, fonts, spacing
    data.js           made-up patients, surgery template, drug list
    store.js          saves and syncs data
    rules.js          safety rules and time maths (no AI)
    ai.js             everything that talks to Claude
    voice.js          listening and speaking
    screens\          schedule, prep, wall, nurse, notes
    simulation.js     scripted surgery
  tests\              automatic checks and the 50 phrases
  offline\            copy that opens without internet
```

Safety rules stay in their own file, so judges can see that **AI doesn't make safety decisions**.

---

## Phase 1: Test the risky parts

**Build:** one plain test page with a button for each feature.

| Build | Finished when |
|---|---|
| Ask Claude | Sorts a sentence into question, event or chatter |
| Dictation | Words appear; we know when it stops and how to restart |
| Spoken answer | A sentence is read aloud |
| Shared data | A tap on the phone changes the laptop |
| Label photo | Text on a printed label is read |
| Save / print | The note can be saved, and we know if PDF works |

**You get:** a test page and a works / doesn't work list.
**Not yet:** design, patients, real screens.

---

## Phase 2: Look and empty screens

**Needs:** phase 1.

| Build | Finished when |
|---|---|
| Colours, fonts, spacing | One style used everywhere |
| Five screens with sample content | All open on laptop and phone |
| Screen menu | You can move between all five |
| Red allergy bar and operating side | Always visible on case screens |

**Skills used:** `artifact-design`, `ui-ux-pro-max`, `frontend-design`.
**You get:** the full app to look at.
**Not yet:** buttons that do real work.

---

## Phase 3: Before surgery

**Needs:** phase 2.

| Build | Finished when |
|---|---|
| 3 made-up patients | Open from the schedule |
| Knee replacement template | Adds checklist, steps, implants, drugs |
| Checklist | Ticks are saved with who and when |
| Plan editor | Changes are saved |
| Allergy rule | Cefazolin is flagged for Ravi Kumar |
| Ready / Blocked | Changes by itself |
| Reset button | Demo goes back to the start |

**Automatic checks:** allergy rule and Ready / Blocked.
**You get:** your checklist dashboard, working.

---

## Phase 4: Live theatre by hand

**Needs:** phase 3.

| Build | Finished when |
|---|---|
| Event log | Keeps time, details, source, status, who confirmed |
| Nurse buttons | Add, Confirm, Edit, Reject all work |
| Wall display | Updates when the nurse taps |
| Steps | Current step moves on |
| Timers | Tourniquet, incision, anaesthesia |
| Tourniquet alert | At 60 minutes, then every 30 |
| Demo clock | Time can be sped up |

**Automatic checks:** timers, alerts, and rejected entries staying out of the record.
**You get:** a whole surgery recorded with buttons, no AI.

---

## Phase 5: AI answers questions

**Needs:** phase 4.

| Build | Finished when |
|---|---|
| Question box | Typed questions get answers |
| Record lookups | Allergies, plan, timers and events come from code |
| Source line | Every answer shows where it came from |
| "Not in the record" | Shown when there is no data |
| Voice question | "Theatre, …" works |
| Spoken answer | Read aloud |
| Demo mode without AI | Main questions still work |

**You get:** the brief's three example questions, working.

---

## Phase 6: AI listens

**Needs:** phase 5.

| Build | Finished when |
|---|---|
| Sorting | Each phrase becomes question, event or chatter |
| Entry maker | "One gram of vancomycin" becomes drug, dose, time |
| Drug name matching | Small mishearings are matched to the list |
| Safety check first | Allergy alert shows before the nurse confirms |
| Suggested entries | Appear on the phone with what was heard |
| Listening sign | Shows listening / stopped, with restart |

**You get:** **the core demo.** We keep a safe copy of this version.

---

## Phase 7: Label photo and reminders

**Needs:** phase 6.

| Build | Finished when |
|---|---|
| Label photo | Size and item are read |
| Size picker | Backup if the photo fails |
| Plan-difference alert | Size 6 against planned size 5 |
| Reason | Spoken or typed, and saved |
| Time Out and Sign Out | Each item can be confirmed |
| Spoken case summary | Read aloud at Time Out |
| Antibiotic reminder | Only for drugs that need a repeat |

**You get:** the "why was a step changed" answer.

---

## Phase 8: Operation note

**Needs:** phase 6 (and 7 for plan differences).

| Build | Finished when |
|---|---|
| Draft | Uses confirmed events only |
| Links | Each recorded fact points to its event |
| Fact check in code | Times, doses and sizes match the events |
| Edit and sign | Surgeon can do both |
| PDF | Saved or printed |
| Ask later | "When was vancomycin given?" |
| Template note | Works without AI |

**Automatic checks:** rejected entries never appear, and all numbers match.
**You get:** **the full demo, start to finish.**

---

## Phase 9: Backups and accuracy

**Needs:** phase 8.

| Build | Finished when |
|---|---|
| Simulation mode | Plays a scripted surgery through |
| Offline copy | Opens with Wi-Fi off |
| Accuracy test | Runs the 50 phrases and shows a score |
| Bug fixes | No known problem breaks the demo |

**You get:** backups and an honest accuracy number. **Feature freeze.**

---

## Phase 10: Polish

**Needs:** phase 9.

| Build | Finished when |
|---|---|
| `unslop` pass | Nothing looks AI-made |
| `impeccable` check | Spacing, text and empty screens are clean |
| Final checks | All earlier tests still pass |

**You get:** the final version. After this, only emergency fixes (phase 11 in PHASES.md).

---

## Build progress

| Phase | Built | Passed by team | Version |
|---|---|---|---|
| 1 Test the risky parts | ☐ | ☐ | |
| 2 Look and empty screens | ☐ | ☐ | |
| 3 Before surgery | ☐ | ☐ | |
| 4 Live theatre by hand | ☐ | ☐ | |
| 5 AI answers questions | ☐ | ☐ | |
| 6 AI listens | ☐ | ☐ | |
| 7 Label photo and reminders | ☐ | ☐ | |
| 8 Operation note | ☐ | ☐ | |
| 9 Backups and accuracy | ☐ | ☐ | |
| 10 Polish | ☐ | ☐ | |
