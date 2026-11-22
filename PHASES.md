# OT Assistant: Build Phases

This file says **what we build, in what order, and when each phase is finished**. The idea and the reasons are in [PLAN.md](PLAN.md).

**Status: not started.** Day 1 is the day the team says "start". Deadline: **30 November 2026**.

## Rules for every phase

1. **One phase at a time.** Claude builds, tests, then shows the team.
2. **The tech pair runs the "Team test"** on the real laptop and phone.
3. **The team says "pass" or lists problems.** Claude fixes problems before moving on.
4. **Save a version** at the end of each phase, so we can go back. Claude pushes to GitHub only when the team says so.
5. **Made-up patients only.** Never real patient data.
6. **Safety rules beat design.** Allergy and operating side always stay visible in red.

## All phases at a glance

| Phase | Name | Day | Result | Priority |
|---|---|---|---|---|
| 0 | Get ready | Before Day 1 | Accounts, devices and research started | Must |
| 1 | Prove the risky parts | 1 | We know voice, AI, sync and photos work | Must |
| 2 | Design and app shell | 1–2 | All five screens exist with the final look | Must |
| 3 | Before surgery | 2 | Checklist, plan and safety warning work | Must |
| 4 | Live theatre, no AI | 3 | Full surgery can be recorded by hand | Must |
| 5 | AI questions | 4 | It answers with sources, by text and voice | Must |
| 6 | AI listening | 5 | Speech becomes entries the nurse confirms | Must |
| 7 | Label photo, Time Out and reminders | 6 | Plan differences are caught and explained | Should |
| 8 | Operation note | 6 | Draft, sign, save as PDF | Must |
| 9 | Backups and accuracy | 7 | Simulation mode and a measured score | Must / Should |
| 10 | Polish and rehearse | 8 | Demo runs smoothly on real devices | Must |
| 11 | Final day | 9 | Spare time, pitch ready | Must |

**Feature freeze: end of Phase 9.** After that, only fixes.

---

## Phase 0: Get ready

**Goal:** nothing blocks us on Day 1.

- [ ] Tech pair: update Chrome on the laptop(s) and phone, and sign in to the same Claude account
- [ ] Tech pair: get a headset or clip-on mic
- [ ] Tech pair: decide if the GitHub repo should be private
- [ ] Research pair: book 3–5 interviews with OT staff
- [ ] Research pair: start the 50 phrases and check the knee replacement details (PLAN.md section 13)

**Done when:** devices are signed in and at least one interview is booked.

---

## Phase 1: Prove the risky parts

**Goal:** find out early what doesn't work. One plain test page, no design.

**Claude builds a page that tests:**
- [ ] Asking Claude a question and getting a sorted answer (question / event / chatter)
- [ ] Dictation in Chrome: how long it listens, and how to restart it
- [ ] Reading an answer aloud
- [ ] Laptop and phone sharing one database
- [ ] Sending a label photo from the phone
- [ ] Saving or printing a PDF

**Team test**
1. Speak 10 phrases with the headset, in a quiet room and then a noisy one.
2. Tap a button on the phone. Does the laptop change?
3. Photograph a printed label. Is the text read correctly?

**Done when:** we have a works / doesn't work list.

**If something fails**

| Fails | Use instead |
|---|---|
| Dictation | Push-to-talk, or typed lines plus simulation mode |
| Spoken answers | Large on-screen answers |
| Label photo | Nurse picks the size from a list |
| Live sync | Both screens side by side on one laptop |
| PDF | Save the note as a file, then print it from the laptop |

---

## Phase 2: Design and app shell

**Goal:** the final look and empty versions of all screens.

- [ ] Choose colours, fonts and spacing (`ui-ux-pro-max`, `frontend-design`, with `artifact-design`)
- [ ] Decide dark green or neutral grey for the wall display
- [ ] Build the five screens: OT schedule, case prep, wall display, nurse console, notes review
- [ ] Menu to switch screens, with sizes for laptop and phone
- [ ] Start from [frontend-mockup.png](frontend-mockup.png)

**Team test**
1. Stand 3 metres from the laptop or TV. Can you read the allergy, timer and answer?
2. On the phone, can you tap every button with a thumb?

**Done when:** the team approves the look.

---

## Phase 3: Before surgery

**Goal:** your checklist dashboard works.

- [ ] 3 made-up patients (Ravi Kumar first) in hospital-record (FHIR) style
- [ ] Knee replacement template: checklist, steps, implants, drugs
- [ ] OT schedule with Ready / Blocked
- [ ] Tick checklist items, with who and when
- [ ] Edit the surgical plan
- [ ] **Allergy rule in code:** cefazolin is flagged for a penicillin allergy
- [ ] Reset button to put the demo back to the start

**Team test**
1. Open Ravi Kumar. The case is **Blocked**, with the cefazolin warning.
2. Change to vancomycin and tick the open items. It turns **Ready**.
3. Reload. Your changes are still there.

**Done when:** all three work, and the research pair has checked the medical details.

---

## Phase 4: Live theatre, no AI

**Goal:** the whole surgery can be recorded by hand. This is the safety net for everything later.

- [ ] Wall display: patient, allergy, steps, timers, live record
- [ ] Nurse console: add, confirm, edit, reject
- [ ] Event log: time, details, source, status, who confirmed
- [ ] Tourniquet timer, with alerts at 60 minutes and every 30 after
- [ ] Demo clock to speed up time
- [ ] Laptop and phone stay in sync

**Team test**
1. Add "Tourniquet on" on the phone and confirm it. The wall timer starts.
2. Speed up the clock. The 60-minute alert appears.
3. Reject an entry. It never joins the confirmed record.
4. Reload both devices. Nothing is lost.

**Done when:** you can act out a full surgery using only buttons.

---

## Phase 5: AI questions

**Goal:** the assistant answers the brief's three questions.

- [ ] Type a question, get an answer with its source
- [ ] Then by voice, starting with "Theatre, …"
- [ ] Answers shown on the wall and spoken
- [ ] Code does the time maths
- [ ] "Not in the record" when there is no data
- [ ] Demo mode without AI for the main questions

**Team test**
1. "Is the patient allergic to anything?"
2. "Which implant size did we plan?"
3. "How long has the tourniquet been on?"
4. "What is the patient's shoe size?" It must say **Not in the record**.
5. Turn on demo mode. Questions 1–3 still work.

**Done when:** all five are right, three times in a row.

---

## Phase 6: AI listening

**Goal:** normal speech becomes entries.

- [ ] Claude sorts each phrase: question, event or chatter
- [ ] Events appear on the phone as Suggested, with what was heard
- [ ] Drug names matched against a list
- [ ] Safety rules run **before** the nurse confirms, and alert at once
- [ ] Clear "listening" / "stopped" sign, with one-tap restart

**Team test**
1. "Giving one gram of vancomycin." A suggestion appears.
2. "Tourniquet on." Confirm it and the timer starts from when it was said.
3. "Nice weather today." Nothing appears.
4. "Giving cefazolin." An allergy alert appears at once.

**Done when:** all four work with the headset. **At this point we have our core demo.**

---

## Phase 7: Label photo, Time Out and reminders

**Goal:** catch differences from the plan and record why.

- [ ] Photo of a label, read by Claude, checked against the plan
- [ ] "Different from plan, reason?" alert, with the reason saved
- [ ] Time Out: spoken case summary and confirmation of each item
- [ ] Sign Out: counts, specimens, implants
- [ ] Antibiotic repeat-dose reminder

**Team test**
1. Photograph the size 6 label when size 5 is planned. The alert appears.
2. Say "better fit at trial". It's saved as the reason.
3. Complete Time Out and Sign Out.

**Done when:** the size 6 story works from photo to saved reason.

**If time is short:** keep the plan-difference alert with a size picker, and tap-through Time Out and Sign Out lists. Drop the rest.

---

## Phase 8: Operation note

**Goal:** a complete note without writing from memory.

- [ ] Draft from **confirmed events only**
- [ ] Each recorded fact links to its event
- [ ] Code checks that times, doses and sizes in the draft match the events
- [ ] Surgeon edits and signs (demo sign-off, not a legal signature)
- [ ] Save as PDF
- [ ] Ask later: "When was vancomycin given?"
- [ ] Simple template note if AI is unavailable

**Team test**
1. Finish a surgery and create the note. Compare every time and size with the record.
2. Check that a rejected entry is **not** in the note.
3. Sign and save the PDF.

**Done when:** the note matches the record with zero mistakes, three times.

---

## Phase 9: Backups and accuracy

**Goal:** the demo can't be ruined, and we have a real number to show.

- [ ] Simulation mode: replays a scripted surgery
- [ ] Offline copy saved on the laptop, because the claude.ai page itself needs internet
- [ ] Run the research pair's 50 phrases and record the score
- [ ] Separate score for understanding (typed) and listening (spoken)
- [ ] Fix the worst mistakes and test again

**Team test**
1. Run the simulation from start to finish.
2. Turn off Wi-Fi and open the offline copy.

**Done when:** both work and the score is written down honestly. **Feature freeze.**

---

## Phase 10: Polish and rehearse

- [ ] `unslop` pass, then `impeccable` final check
- [ ] Fix small text, spacing and confusing words
- [ ] 3 full rehearsals on the real devices, with a timer (5 minutes)
- [ ] Record the backup video
- [ ] Print labels and pack (PLAN.md section 14)

**Done when:** two rehearsals in a row have no failures.

---

## Phase 11: Final day

- [ ] Morning check: sign-in, mic, internet, reset the demo
- [ ] Final slides and judge answers
- [ ] One last rehearsal. Keep AI use light to save the Pro limit
- [ ] No code changes unless something is broken

**Done when:** everyone knows their part.

---

## If we run out of time

Cut in this order:
1. Antibiotic reminder
2. Spoken Time Out (tap through it instead)
3. Label photo (pick the size from a list instead)
4. Spoken answers (on-screen only)

**Never cut:** checklist, wall display, nurse confirm, three questions with sources, speech to entries, allergy alert, tourniquet timer, operation note, demo mode.

## Who does what in each phase

| Phases | Tech pair | Research pair |
|---|---|---|
| 0–2 | Set up devices, test risky parts, approve look | Interviews, 50 phrases |
| 3–4 | Test every button on laptop and phone | Check medical details, finish phrases |
| 5–6 | Test voice with the headset | Write judge questions, pick quotes |
| 7–8 | Test labels, notes and PDF | Check the note layout, start slides |
| 9–11 | Run the demo and backups | Accuracy results, slides, backup video |

## Progress

| Phase | Started | Passed | Notes |
|---|---|---|---|
| 0 | | | |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
| 11 | | | |
