# OT Assistant: Build Phases

**This is the file we follow for building.** One small phase at a time: frontend first, then backend, then AI, then finishing. The full idea is in [PLAN.md](PLAN.md).

**Status: not started. Next: Phase 0.**

## Rules

1. The team says **"start phase 1"**. Claude builds **only phase 1** and stops.
2. Claude shows it and explains what to check.
3. The team says **"pass"**, or says what to change.
4. Claude saves a version and updates the progress table.
5. Claude **waits**. It never starts the next phase by itself.

## The big picture

| Part | Phases | What it means |
|---|---|---|
| **Start** | 0 | Quick check that the risky features work |
| **A. Frontend** | 1–7 | What you see. Sample data; nothing is saved yet |
| **B. Backend** | 8–13 | What makes it work: saving, sync, timers, safety rules |
| **C. AI** | 14–19 | Questions, listening, label photos, operation note |
| **D. Finish** | 20–23 | Backups, accuracy, polish, rehearsal |

In our app, "backend" means the artifact's shared database and our own code. There is no separate server.

---

# Start

## Phase 0: Quick feature check
**Build:** a plain page that tests Claude, mic, spoken voice, phone sync, label photo and saving a file.
**You check:** try each button on the laptop and phone.
**Done when:** we have a works / doesn't work list.
**Not in this phase:** any design.

Why first: if the mic fails, the screens need a different design. It's a small step, then we go to the dashboard.

---

# Part A: Frontend

Everything here uses **sample data**. Buttons may move between screens, but nothing is saved.

## Phase 1: Style and menu
**Build:** colours, fonts, buttons, cards, the red allergy bar, and a menu to move between screens.
**You check:** do you like the look? Is it readable on laptop and phone?
**Done when:** the team approves the style.
**Not in this phase:** real screens.

## Phase 2: Dashboard
**Build:** the home screen, with today's surgeries, time, surgeon, and Ready / Blocked for each.
**You check:** can you tell in 5 seconds which case is blocked?
**Done when:** the dashboard looks right with 3 sample patients.
**Not in this phase:** opening a real case.

## Phase 3: Case prep screen
**Build:** patient summary, pre-op checklist, surgical plan and the antibiotic warning box.
**You check:** is all the patient information easy to find?
**Done when:** Ravi Kumar's page looks complete.
**Not in this phase:** saving ticks or real safety checks.

## Phase 4: Wall display screen
**Build:** dark screen with patient, allergy, steps, timers, answer box and live record.
**You check:** can you read it from 3 metres?
**Done when:** it's readable on the TV or projector.
**Not in this phase:** running timers.

## Phase 5: Nurse phone screen
**Build:** suggested entry with Confirm / Edit / Reject, confirmed list, Add entry, Scan label.
**You check:** can you use every button with a thumb?
**Done when:** it fits your phone with no side scrolling.
**Not in this phase:** buttons that save.

## Phase 6: Notes screen
**Build:** operation note beside the timeline, with Edit, Sign and Save PDF buttons.
**You check:** is the note easy to read and compare?
**Done when:** the sample note looks complete.
**Not in this phase:** AI writing the note.

## Phase 7: Frontend review
**Build:** fixes across all screens: empty states, error messages, sizes, spacing.
**You check:** click through every screen on both devices.
**Done when:** the team says the **frontend is finished**.
**Not in this phase:** new features.

---

# Part B: Backend

## Phase 8: Database and patients
**Build:** the shared database, 3 made-up patients, the knee replacement template, and a reset button.
**You check:** open a patient from the dashboard, then reload the page.
**Done when:** screens show saved data instead of sample data.

## Phase 9: Working checklist and plan
**Build:** save ticks (who and when), edit the plan, change Ready / Blocked automatically.
**You check:** tick the open items and reload. Are they still ticked?
**Done when:** a case turns Ready by itself.

## Phase 10: Event log and nurse buttons
**Build:** Add, Confirm, Edit and Reject now save, with time and who did it.
**You check:** reject an entry. It must stay out of the confirmed record.
**Done when:** all four buttons work.

## Phase 11: Laptop and phone sync
**Build:** live updates between the wall display and the phone.
**You check:** tap Confirm on the phone and watch the laptop.
**Done when:** it updates without a reload, and recovers after the internet drops.

## Phase 12: Timers and steps
**Build:** tourniquet, incision and anaesthesia timers, surgery steps, 60-minute alert, and a demo clock to speed up time.
**You check:** speed up the clock until the alert shows.
**Done when:** timers are right, even after a reload.

## Phase 13: Safety rules
**Build:** allergy check, drug list, plan-difference check, and antibiotic reminder. All in normal code, **no AI**, with automatic tests.
**You check:** add cefazolin for Ravi Kumar. An alert must show.
**Done when:** every rule test passes.

**After Phase 13 the app works without AI.** Keep a safe copy.

---

# Part C: AI

## Phase 14: Typed questions
**Build:** type a question and get an answer **with its source**. "Not in the record" when there's no data.
**You check:** the three example questions, plus "What is the patient's shoe size?"
**Done when:** all four are right, three times in a row.

## Phase 15: Voice questions
**Build:** ask by mic with "Theatre, …", and the answer is spoken.
**You check:** ask the three questions with the headset.
**Done when:** all three work in a normal room.

## Phase 16: Listening for events
**Build:** speech becomes suggested entries on the nurse's phone. Chatter is ignored, and safety rules run first.
**You check:** "Giving one gram of vancomycin", "Tourniquet on", "Nice weather today".
**Done when:** two suggestions appear and the third phrase is ignored.

**This is the core demo.** Keep a safe copy.

## Phase 17: Label photo
**Build:** the phone photo is read and checked against the plan. The app asks and saves the reason. Size picker as backup.
**You check:** photograph size 6 when size 5 is planned.
**Done when:** the alert shows and the reason is saved.

## Phase 18: Time Out and Sign Out
**Build:** both checklists, plus a spoken case summary.
**You check:** complete both for Ravi Kumar.
**Done when:** both are saved in the record.

## Phase 19: Operation note
**Build:** AI draft from confirmed events, code check of every time, dose and size, edit, sign, PDF, and "When was vancomycin given?"
**You check:** compare the note with the timeline.
**Done when:** zero mistakes, three times.

**This is the full demo.** Keep a safe copy.

---

# Part D: Finish

## Phase 20: Backups
**Build:** demo mode without AI, simulation mode, and an offline copy on the laptop.
**You check:** run the simulation, then open the offline copy with Wi-Fi off.
**Done when:** both work.

## Phase 21: Accuracy test
**Build:** a test that runs the 50 phrases and shows a score. Fix the worst mistakes.
**You check:** read the score and the mistakes.
**Done when:** the honest score is written down. **No new features after this.**

## Phase 22: Final polish
**Build:** `unslop` pass, then `impeccable` check. All earlier checks run again.
**You check:** click through everything.
**Done when:** no known problem breaks the demo.

## Phase 23: Rehearse
**Build:** nothing new, only emergency fixes.
**You check:** full 5-minute demo on the real devices, and record the backup video.
**Done when:** two rehearsals in a row have no failures.

---

## Fitting it before 30 November

If we start on 24 November (7 days):

| Day | Phases |
|---|---|
| 24 | 0–3 |
| 25 | 4–7 |
| 26 | 8–11 |
| 27 | 12–14 |
| 28 | 15–17 |
| 29 | 18–21 |
| 30 | 22–23 |

This is tight. If we fall behind, cut in this order: spoken case summary, antibiotic reminder, label photo (keep the size picker), spoken answers.

**Never cut:** 1–6, 8–12, the allergy alert, 14, 16, 19, and demo mode.

---

## Progress

| Phase | Built | Passed |
|---|---|---|
| 0 Feature check | ☐ | ☐ |
| 1 Style and menu | ☐ | ☐ |
| 2 Dashboard | ☐ | ☐ |
| 3 Case prep | ☐ | ☐ |
| 4 Wall display | ☐ | ☐ |
| 5 Nurse phone | ☐ | ☐ |
| 6 Notes screen | ☐ | ☐ |
| 7 Frontend review | ☐ | ☐ |
| 8 Database and patients | ☐ | ☐ |
| 9 Checklist and plan | ☐ | ☐ |
| 10 Event log | ☐ | ☐ |
| 11 Sync | ☐ | ☐ |
| 12 Timers and steps | ☐ | ☐ |
| 13 Safety rules | ☐ | ☐ |
| 14 Typed questions | ☐ | ☐ |
| 15 Voice questions | ☐ | ☐ |
| 16 Listening | ☐ | ☐ |
| 17 Label photo | ☐ | ☐ |
| 18 Time Out and Sign Out | ☐ | ☐ |
| 19 Operation note | ☐ | ☐ |
| 20 Backups | ☐ | ☐ |
| 21 Accuracy test | ☐ | ☐ |
| 22 Final polish | ☐ | ☐ |
| 23 Rehearse | ☐ | ☐ |
