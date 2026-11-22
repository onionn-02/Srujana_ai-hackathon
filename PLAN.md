# OT Assistant: Project Plan

**Srujana Hackathon Series · Batch 3 · Problem 01 (Medical): The Operating Theatre Assistant**

| | |
|---|---|
| Team | 4 people: 2 technical (testing and monitoring), 2 research. Claude writes all the code. |
| Deadline | 30 November 2026 (earlier if possible) |
| Plan written | 22 November 2026 |
| Status | **Planning only.** Building starts when the team tells Claude to start. |
| How it runs | As a **Claude artifact**: a web page hosted on claude.ai that uses the team's own Claude account for AI, voice and sync. **No API   key needed.** |

---

## Contents

1. [The problem](#1-the-problem)
2. [Our idea](#2-our-idea)
3. [Who uses it](#3-who-uses-it)
4. [How it works: three phases](#4-how-it-works-three-phases)
5. [Screens (UI/UX)](#5-screens-uiux)
6. [How the AI works](#6-how-the-ai-works)
7. [The camera](#7-the-camera)
8. [Demo case: left total knee replacement](#8-demo-case-left-total-knee-replacement)
9. [Tech stack](#9-tech-stack)
10. [What the app stores](#10-what-the-app-stores)
11. [What we build, in priority order](#11-what-we-build-in-priority-order)
12. [Schedule](#12-schedule)
13. [Team roles and tasks](#13-team-roles-and-tasks)
14. [Demo-day setup](#14-demo-day-setup)
15. [AI access and costs](#15-ai-access-and-costs)
16. [Later: more demo cases](#16-later-more-demo-cases)
17. [Risks and how we handle them](#17-risks-and-how-we-handle-them)
18. [Open items](#18-open-items)
19. [Glossary](#19-glossary)

---

## 1. The problem

**During surgery**, a lot happens fast: steps of the procedure, instruments called for, medicines given, implants placed, surprises handled. The information the team needs (history, allergies, scans, surgical plan) is spread across different places. If the surgeon wants to check something mid-operation, someone has to step away and search, or the team relies on memory.

**After surgery**, the surgeon writes the operation notes from memory, often hours later and between other cases. Timings, instruments, implant details and small complications get forgotten or recorded vaguely. Later, nobody can reliably say when a medicine was given or why a step was changed.

**The brief imagines** an assistant that:
- already knows the patient (from the hospital system, HIMS) and the planned surgery,
- sees and hears the room,
- follows the procedure step by step,
- tracks instruments, medicines and events,
- answers questions on the spot, such as:
  - "Is the patient allergic to anything?"
  - "Which implant size did we plan?"
  - "How long has the tourniquet been on?"
- writes complete surgical notes at the end.

### How we will be judged

| Criterion | Points | What judges look for |
|---|---|---|
| Problem understanding and user insight | **25** | We understand who is affected and why, and **learned from real people** |
| Originality | **20** | A fresh approach, **not the obvious first idea** |
| Fit and feasibility | **20** | Why this is the best option and how it would work in real life |
| Prototype | **20** | A working version of the most important part |
| Presentation and Q&A | **15** | Clear, on time, confident answers |

---

## 2. Our idea

> An OT assistant that **knows the patient** (from the hospital system), **knows the plan**, **listens** to the team, **answers with its sources**, and turns what happens into a **confirmed timeline** that becomes the surgical note automatically.

### The key insight

In a real OT, the person who keeps the record is the **circulating nurse**: the only team member who isn't sterile and can touch a screen. So:
- the **surgeon talks**, because their hands are sterile;
- the **wall screen shows** the answers and the live record;
- the **circulating nurse confirms** each entry with one tap on a phone or tablet.

**The AI suggests; people confirm.** That's why the final record can be trusted.

### Why this approach and not the alternatives

The brief asks us to explain this, and it's worth points under "fit and feasibility".

| Alternative | Why not | What we do instead |
|---|---|---|
| Digital pre-op checklist only | It's the obvious idea, and hospitals already have it. It doesn't help during surgery or with notes. | We keep the checklist as the **base** that feeds the assistant. |
| A camera that watches and understands the whole surgery | Not reliable today, needs huge amounts of training video, and raises privacy concerns | The camera only **reads labels and barcodes** on implants and drugs (see section 7). |
| A dictation app that records and transcribes everything | A transcript is messy and unchecked, and someone still has to turn it into a note. | We build a **confirmed event log** first, then write the note from it. |
| A fully automatic AI record with no human check | One wrong entry in a medical record is dangerous. | The AI suggests and the nurse confirms. Safety checks run as fixed rules, not AI. |

---

## 3. Who uses it

| Person | Situation | How they use the assistant |
|---|---|---|
| Surgeon | Sterile hands, focused on the patient | Talks to it ("Theatre, …"), glances at the wall screen, signs the final note |
| Anaesthetist | Gives drugs, watches timings | Their spoken drug doses are picked up; gets timer and repeat-dose alerts |
| Scrub nurse | Sterile, handles instruments | Calls out counts and implants; the assistant picks them up |
| Circulating nurse | Not sterile, free to use a screen | **Main operator:** confirms, edits or rejects suggested entries; scans labels with the phone |
| Ward / pre-op team | Before surgery | Fill in the pre-op checklist and surgical plan |

---

## 4. How it works: three phases

### Phase 1: Before surgery (the checklist dashboard)

1. The patient's data comes from the mock hospital system (HIMS): personal details, allergies, conditions, current medicines, lab results, scan reports and blood group.
2. The surgeon picks a **procedure template** (for example, "Total Knee Replacement"). The template creates:
   - **Pre-op checklist:** consent signed, site marked, blood tests, crossmatch, ECG, X-ray, fasting confirmed, blood thinners stopped, and so on.
   - **Procedure steps**, in order.
   - **Plan details:** planned implants with sizes, planned drugs (such as the preventive antibiotic), and whether a tourniquet will be used.
3. The team ticks off checklist items. Each case shows **Ready** or **Blocked**, for example "Blocked: crossmatch pending".
4. The **AI checks the plan against the patient** before surgery. For example: "Plan lists cefazolin, but the patient has a penicillin allergy. Review possible cross-reaction." This happens before the patient even enters the room.

### Phase 2: During surgery (the main feature)

We follow the **WHO Surgical Safety Checklist** that operating theatres already use (Sign In, Time Out, Sign Out).

1. **Sign In / Time Out.** The assistant reads a short case summary aloud (about 20 seconds): name, age, operation and side, allergies, blood available and planned implants. The team then confirms each Time Out item by voice.
2. **Live tracking.** As people speak, the assistant picks up events: drugs given, tourniquet on and off, incision, implants opened, counts and complications. Each one appears on the nurse's phone as **Suggested**, with **Confirm / Edit / Reject** buttons.
3. **Questions.** "Theatre, is the patient allergic to anything?" The answer is **spoken aloud and shown on the wall screen**, together with where it came from (for example, "Allergy record, HIMS").
4. **Automatic alerts:**
   - The tourniquet has been on for 60 minutes, then every 30 minutes after that.
   - An antibiotic repeat dose is due, for antibiotics that need one.
   - A drug clashes with an allergy.
   - **Something differs from the plan.** For example, a scanned implant doesn't match the planned size. The screen asks "Different from plan, reason?" and **the spoken reason is recorded**. This answers the brief's "why was a step changed".
5. **Sign Out.** Counts are correct, specimens are labelled and implants are recorded.

### Phase 3: After surgery

1. One click, and the AI drafts the **operation note** from the **confirmed event log**, not from memory and not from the raw transcript. Each sentence links back to the event it came from.
2. The surgeon reads it, edits it and **signs** it. It's saved as a **PDF**, and implant details are kept for tracing.
3. Later, anyone can ask, for example, "When was vancomycin given?" and get the exact time from the record.

---

## 5. Screens (UI/UX)

| # | Screen | Used by | Purpose |
|---|---|---|---|
| 1 | **OT schedule** | Everyone | Today's cases, each marked Ready or Blocked |
| 2 | **Case prep** | Surgeon / ward team | Patient summary, checklist, plan editor, AI warnings before surgery |
| 3 | **Theatre wall display** | Whole team | Dark theme, large text readable from 3 metres, no touching needed |
| 4 | **Nurse console** (phone or tablet) | Circulating nurse | Confirm/Edit/Reject entries, add entries by hand, scan labels with the camera |
| 5 | **Notes review** | Surgeon | Draft note next to the timeline; edit, sign, export to PDF |

### Wall display (sketch)

```
┌────────────────────────────────────────────────────────────────────────┐
│ RAVI KUMAR · 64 M · LEFT TOTAL KNEE REPLACEMENT · Dr. Rao   ⏱ 00:47:12 │
│ ⚠ ALLERGY: PENICILLIN (anaphylaxis)    Blood B+ · 2 units crossmatched │
├────────────────┬───────────────────────────────┬───────────────────────┤
│ STEPS          │ TIMERS                        │ LIVE RECORD           │
│ ✓ Time out     │ Tourniquet  00:38  ▓▓▓▓░░ 60m │ 09:40 Vancomycin 1g ✓ │
│ ✓ Incision     │ Since incision  00:31         │ 10:21 Tourniquet on ✓ │
│ ▶ Bone cuts    │ Anaesthesia 00:52             │ 10:58 Femoral sz 5  … │
│ ○ Trial        ├───────────────────────────────┤                       │
│ ○ Implants     │ Q: "Which implant size did    │                       │
│ ○ Closure      │    we plan?"                  │                       │
│                │ Femoral 5, tibial 4, insert   │                       │
│                │ 10 mm  — source: surgical plan│                       │
├────────────────┴───────────────────────────────┴───────────────────────┤
│ 🎙 Listening… "…okay, open the size five femoral…"                     │
└────────────────────────────────────────────────────────────────────────┘
```

### Nurse console on the phone (sketch)

```
┌───────────────────────────┐
│ Ravi Kumar · L knee (TKR) │
│ ⚠ PENICILLIN              │
├───────────────────────────┤
│ SUGGESTED                 │
│ 10:58 Femoral implant sz 5│
│ heard: "open the size     │
│ five femoral"             │
│ [Confirm] [Edit] [Reject] │
├───────────────────────────┤
│ CONFIRMED                 │
│ 10:21 Tourniquet on       │
│ 09:40 Vancomycin 1 g IV   │
├───────────────────────────┤
│  [+ Add entry]  [📷 Scan] │
└───────────────────────────┘
```

### UX rules

- The **allergy** and the **operating side** are always visible, in red.
- **Nothing on the wall screen needs a touch.**
- **Every AI answer shows its source.** If something isn't recorded, it says so instead of guessing.
- Alerts use **sound and colour**, never pop-ups someone has to close.
- Large text and high contrast throughout. The wall screen uses a dark theme so it isn't glaring in the OT.

---

## 6. How the AI works

### Do we need machine learning?

**No machine learning training.** We use ready-made AI services plus normal code.

| Part | What does it | Why |
|---|---|---|
| Speech to text | Claude's built-in **dictation** (needs Chrome or the Claude desktop app) | Comes with the Claude account |
| Understanding and answering | **Claude**, asked by the page, with "tools" (small page functions it can call to fetch data) | Copes with messy speech, picks out events, writes the note |
| Reading labels | Claude reading a **photo** of the label taken on the phone | The realistic "sees" part (section 7) |
| Safety checks | **Normal code with fixed rules** | Allergy clashes, timers, repeat doses and plan differences must always behave the same way |
| Speaking back | Claude's **text-to-speech** voice (on-screen text if unavailable) | Comes with the Claude account |

### The flow

```
Mic → speech-to-text → transcript
        │
        ▼
   Claude decides: is this a question to me, a clinical event, or chatter?
        ├─ Question → fetches data with tools (allergies, plan, timers, events)
        │             → answer + source → wall screen + spoken reply
        ├─ Event    → structured entry, e.g. {type: drug, name, dose, time}
        │             → rule checks: allergy clash? matches plan? start a timer?
        │             → nurse phone: Confirm / Edit / Reject → event log
        └─ Chatter  → ignored

Phone camera → barcode or label photo → Claude reads it → implant/drug event → same path

End of surgery: patient data + plan + confirmed event log → Claude → draft note → surgeon signs → PDF
```

### Example 1: a question

The surgeon asks: *"Theatre, how long has the tourniquet been on?"*
1. Speech-to-text turns the audio into text.
2. Claude sees that it's a question and asks the app for the tourniquet timer.
3. **The app's code works out the time** (for example, 38 minutes). The AI never does time maths itself.
4. Claude phrases the answer: "Tourniquet on for 38 minutes, since 10:21."
5. The wall screen shows it and the laptop speaks it.

### Example 2: an event

The anaesthetist says: *"Giving one gram of vancomycin."*
1. Claude turns this into an entry: drug = vancomycin, dose = 1 g, time = now.
2. The **rule checks** run: is it on the allergy list? Is it similar to something the patient is allergic to? Was it in the plan?
3. The entry appears on the nurse's phone as **Suggested**. One tap confirms it.

### Design rules

These are also our answers to judges' questions.

- **The AI talks; code decides.** Allergy checks and timers never depend on the AI getting it right.
- **Answers come only from the record.** If something isn't there, the answer is "Not in the record". It never guesses.
- **Code does the time maths**, and the AI only phrases the answer.
- **No search database needed.** One patient's data is small enough to give Claude in full.
- **Wake word plus push-to-talk.** Questions start with "Theatre, …". A push-to-talk key works too. In a real OT this could be a **USB foot pedal**, which behaves like a keyboard key, so the code is the same.
- **We measure accuracy.** The research team writes about 50 real OT phrases, and we test how many the assistant gets right. A real number helps the feasibility score.
- **Model:** the artifact asks Claude through the team's account. Live answers use the quick setting; the operation note uses the more thorough setting.

---

## 7. The camera

**What we won't do:** a camera that watches and understands the whole surgery. It isn't reliable enough today, needs a lot of training video, and raises privacy concerns. We mention it in the pitch as **future work** and explain why.

**What we will do:** the circulating nurse holds an **implant box or drug vial** up to the phone camera.
1. The nurse takes a **photo of the label**, and Claude reads it. (There's no live camera feed in an artifact, so it's a photo, not continuous scanning.)
2. It logs the item (for example, "Femoral component, size 6").
3. It checks the item against the plan. If the plan says size 5, it raises a **"Different from plan, reason?"** alert.

This is realistic, useful in real life (implant tracing), and easy to demo with printed mock labels.

---

## 8. Demo case: left total knee replacement

### The made-up patient

All demo data is **made up**. No real patient data is ever used, because the rules allow only public, made-up or consented data.

| Item | Value (research team to check that it's realistic) |
|---|---|
| Name / age / sex | Ravi Kumar, 64, male |
| Operation | Left total knee replacement (TKR) |
| Allergy | **Penicillin: anaphylaxis** |
| Conditions | Type 2 diabetes, high blood pressure (example) |
| Blood group | B+, 2 units crossmatched |
| Planned implants | Femoral component size 5, tibial component size 4, insert 10 mm (example sizes) |
| Planned antibiotic | Cefazolin in the first draft of the plan. The AI flags it and the team switches to vancomycin. |
| Tourniquet | Yes, thigh tourniquet |

### Demo script (about 5 minutes)

1. **Case prep:** show the checklist. The AI warns about cefazolin and the penicillin allergy, the team switches to vancomycin, and the case turns **Ready**.
2. **Time Out:** the assistant reads the case summary aloud, and the team confirms by voice.
3. Ask: **"Theatre, is the patient allergic to anything?"** The answer is spoken and shown with its source.
4. Say **"Tourniquet on."** The timer starts. Using the **demo clock** (speeds up time), the 60-minute alert appears within seconds.
5. Ask: **"Which implant size did we plan?"**
6. **Scan** a printed implant label showing size 6. A plan-difference alert appears, the surgeon says why, and the reason is recorded.
7. Ask: **"How long has the tourniquet been on?"**
8. **Sign Out.** The operation note is generated in seconds. Open the **PDF**.
9. Afterwards, ask: **"When was vancomycin given?"** The exact time comes from the record.

**Backups:**
- **Simulation mode** replays a scripted surgery at high speed, in case the hall is noisy or the mic fails.
- A **recorded backup video** of the full demo.

---

## 9. Tech stack

Claude picks and builds everything. The team does not need to learn any of this.

The whole app is a **Claude artifact**: one web page hosted on claude.ai. Everyone opens the same link while signed in to the team's Claude account.

| Part | What we use | What it does | Cost |
|---|---|---|---|
| The app | **Claude artifact** (HTML + JavaScript page on claude.ai) | All screens; the page switches between wall display, nurse console, case prep and notes | Included in Claude Pro |
| AI | Artifact **"ask Claude"** feature (images allowed) | Understanding, answers, label reading, note writing | Counts against Pro usage limits |
| Voice in | Artifact **dictation** | Speech to text (Chrome or Claude desktop app) | Included |
| Voice out | Artifact **text-to-speech** | Reads answers aloud | Included |
| Data + live sync | Artifact **shared database** and **room** (live messages between open pages) | Stores cases and events; keeps laptop and phone updated live | Included |
| Saving the note | Artifact **downloads** | Saves the operation note as a file (PDF via print) | Included |
| Mock hospital system | Made-up data in **FHIR** format (the standard for hospital records) | Lets us say: "In a real hospital, we swap this for their FHIR/HL7 connection." | Free |

### Accounts

Nothing new to create. Every device (laptop(s) and phone) just needs to be **signed in to the team's Claude account** in Chrome.

### For the pitch

We present this as a **working prototype on claude.ai**. A real hospital version would use the Claude API, run on hospital servers, and connect to the hospital system.

---

## 10. What the app stores

| Item | What it holds |
|---|---|
| Patient | Details, allergies, conditions, medicines, lab results, scan reports, blood group (from the mock HIMS) |
| Case | Which patient, which operation and side, surgeon, anaesthetist, date and time, status |
| Checklist item | Phase (pre-op / Sign In / Time Out / Sign Out), item, done or not, by whom, when |
| Surgical plan | Steps, planned implants and sizes, planned drugs, tourniquet yes/no |
| **Event** (the heart of the app) | Time, type (drug / implant / step / tourniquet / count / complication / plan difference / note), details, source (voice / scan / manual), status (suggested / confirmed / rejected), who confirmed it, what was heard |
| Timer | Name, start, stop, alert points |
| Operation note | AI draft, final text, signed by, signed when |
| Procedure template | Steps, checklist, usual drugs and implants for one type of surgery |

---

## 11. What we build, in priority order

### Must have (the demo depends on these)
- Mock hospital system with 2–3 made-up patients (the knee replacement patient first)
- OT schedule and case prep screen with checklist, plan and Ready/Blocked status
- Theatre wall display
- Nurse console on the phone, with Confirm / Edit / Reject
- Questions answered by voice or typing, **with sources**
- Event capture from speech, then suggest, then confirm
- Tourniquet timer with alerts, and a **demo clock** to speed up time
- Allergy clash alert
- Operation note generation and PDF
- **Demo mode without AI** (works even without an API key or internet), which is also our safety net

### Should have (if time allows)
- Phone camera label scan with the plan-difference "reason?" flow
- Spoken Time Out with case summary
- Antibiotic repeat-dose reminder
- Simulation mode (replays a scripted surgery)
- Accuracy test with the research team's 50 phrases

### Pitch only (future plans, not built)
- Recognising instruments from video
- Knowing who said what (speaker detection)
- Automatic swab and instrument counting
- Connection to a real hospital system
- Running on hospital servers for privacy
- More languages

---

## 12. Schedule

**Day 1 is the day the team tells Claude to start.** The deadline stays **30 November**.

| Day | What Claude builds | What the team checks |
|---|---|---|
| 1 | First version of the artifact, the app's look | The link opens on the laptop and phone |
| 2 | Mock hospital data (3 made-up patients), OT schedule, case prep, checklist | Click through the knee replacement patient |
| 3 | Wall display, nurse console, laptop–phone sync, event log, timers, demo clock | Phone and laptop update together |
| 4 | **AI part 1:** answers with sources (typed, then spoken), spoken replies, allergy clash alert, demo mode without AI | Ask the 3 example questions |
| 5 | **AI part 2:** listening for events, then suggest and confirm; spoken Time Out with case summary; plan-difference alert | Act out a short surgery |
| 6 | Operation note, review screen, PDF; phone camera label scan | Scan the printed label |
| 7 | Simulation mode, accuracy test, bug fixes. **No new features after this day.** | Full run-through |
| 8 | Polish, rehearsals on the real devices, backup video | Full rehearsal |
| 9 | Spare day and final rehearsal | — |

**If we start late and have fewer than 9 days:**
1. Shorten the polish and spare days (8–9) first.
2. Then move "Should have" items to "Pitch only".
3. The "Must have" list does not shrink.

**Usage note:** Claude does the building on the user's Claude Pro plan, which has usage limits that reset every few hours. If a limit is hit, work continues after the reset, so it helps to start each day early.

---

## 13. Team roles and tasks

### Claude
- Writes all the code and tests it.
- Gives a short daily update: what's new and how to try it.

### Tech pair (monitoring and testing)
- [ ] Make sure the laptop(s) and phone are signed in to the Claude account in Chrome.
- [ ] Test each day's build on the laptop and phone, and tell Claude what's broken or confusing.
- [ ] Own the demo devices: laptop(s), phone, mic, printed labels.
- [ ] Learn to run the demo, demo mode and simulation mode without help.

### Research pair

**Before and during the first days of building:**
- [ ] Interview **3–5 OT staff**: nurses especially, plus surgeons and anaesthetists. Questions are below.
- [ ] Collect realistic details so the made-up data is believable:
  - [ ] Steps of a total knee replacement
  - [ ] Usual drugs and doses in a TKR, and the preventive antibiotic and its alternatives for penicillin allergy
  - [ ] Typical implant size ranges
  - [ ] Tourniquet time limits and when staff are usually reminded
  - [ ] Which antibiotics need a repeat dose, and after how long
  - [ ] The usual layout of an operation note (a template only, never a real patient's note)
  - [ ] The WHO Surgical Safety Checklist items
- [ ] Write **50 phrases OT staff really say**, each with what should be recorded. For example:

| Phrase | What should be recorded |
|---|---|
| "Tourniquet up at 250." | Tourniquet ON, pressure 250 mmHg |
| "One gram vanc going in." | Drug: vancomycin 1 g, given now |
| "Open the size five femoral." | Implant opened: femoral component, size 5 |
| "Swab count is correct." | Count: swabs correct |
| "Theatre, any allergies?" | Question about allergies (not an event) |

**Final days:**
- [ ] Pitch slides: problem, interview quotes, our approach versus the alternatives (section 2), feasibility, future plans.
- [ ] Record the backup demo video.
- [ ] Prepare answers to likely judge questions: Is it safe? What if it mishears? Privacy? Cost? How would a hospital adopt it?

### Interview questions

1. How do you record drug times and tourniquet times today? Who does it?
2. Who writes the operation note, when, and how long does it take?
3. What usually gets forgotten or recorded vaguely?
4. During surgery, what do you most often need to look up? How do you do that now?
5. Has a missing or wrong record ever caused a problem? (No patient names.)
6. Would you be comfortable talking to an assistant during surgery? What would make you trust it?
7. Who would be the right person to confirm entries: the circulating nurse, or someone else?
8. Would a screen on the wall help or distract?
9. What would make this useless or annoying for you?
10. If you could have one thing from this assistant, what would it be?

Note each person's role and **one or two quotes** for the pitch.

---

## 14. Demo-day setup

| Device | What it shows |
|---|---|
| **Laptop 1** (on the projector/TV) | Theatre wall display, which is what the judges watch. Its mic does the listening. |
| **Phone** | Nurse console: confirm events and scan labels with the camera |
| **Laptop 2** (if available) | Case prep before surgery and notes review after. Without it, Laptop 1 switches between screens. |

### Bring
- [ ] Printed mock **implant box label** (with barcode) and **drug vial label**
- [ ] A cheap **headset or clip-on mic**, because a noisy hall is the biggest risk to voice recognition
- [ ] Phone hotspot as backup internet
- [ ] Chargers and an HDMI cable/adapter
- [ ] The backup demo video, saved offline on a laptop

### If something fails on stage
- Voice not working: **type the question** instead (same answers).
- Internet down: switch to **demo mode without AI**, or play the **backup video**.
- Something else goes wrong: run **simulation mode**.

---

## 15. AI access and costs

- **We use the team's Claude Pro account, through a Claude artifact.** This is Anthropic's own allowed route. (Putting a Pro login inside our own separate website is not allowed; that would need a paid API key.)
- **No extra cost.** AI calls count against the Pro plan's **usage limits**.
  - Avoid heavy testing in the hours before the demo, so limits aren't used up.
  - The **demo mode without AI** is the backup if a limit is hit.
- Claude writing the code in Claude Code also uses the Pro plan, so long build days may hit limits. Work continues after the reset.
- If we ever want our own website instead, the fallback is a Claude Console API key (about $10–20 for the whole hackathon).

---

## 16. Later: more demo cases

Each type of surgery is a **template** (steps, checklist, usual drugs and implants). Adding a case means adding a template and a made-up patient, with **no new screens**.

Good candidates, chosen by the research team based on interviews:
- **Keyhole gallbladder removal** (laparoscopic cholecystectomy): no implants, but shows counts, drug timings and step tracking.
- **Caesarean section:** very common, and involves two patients (mother and baby) and important drug timings.

---

## 17. Risks and how we handle them

| Risk | How we handle it |
|---|---|
| Noisy hall, speech misheard | Headset mic, typed questions as a backup, simulation mode |
| Drug names misheard ("vanco mycin") | Match against a drug list, and the nurse confirms every entry |
| No internet at the demo | Phone hotspot, demo mode without AI, backup video |
| Pro usage limit hit during the demo | Little testing right before the demo; demo mode without AI; backup video |
| Pro usage limit hit while building | Start each day early; work continues after the reset |
| Dictation or voice not available on a device | Use Chrome on the laptop; typed questions and on-screen answers always work |
| A device isn't signed in to Claude | Check sign-in on every device the day before |
| Judges ask "is it safe?" | The AI suggests and humans confirm; safety rules are fixed code; answers show sources; the surgeon signs the note. It is decision **support**, not decision making. |
| Judges ask about privacy | Made-up data only. In real use it would run on hospital servers, keep only confirmed entries rather than audio, and require sign-in. |
| Running out of time | Strict priority list (section 11); "Must have" items come first |

---

## 18. Open items

- [ ] **Start date:** the team will tell Claude when to begin.
- [ ] Is **Laptop 1** the laptop Claude is running on?
- [ ] Is a **second laptop** available for the demo?
- [ ] Which **second demo case** to add later.

---

## 19. Glossary

| Term | Meaning |
|---|---|
| **OT** | Operating theatre |
| **HIMS** | Hospital Information Management System: where patient records live |
| **FHIR / HL7** | Standard formats hospitals use to share patient data between systems |
| **WHO Surgical Safety Checklist** | A world-standard checklist with three pauses: Sign In (before anaesthesia), Time Out (before the first cut), Sign Out (before the patient leaves) |
| **Circulating nurse** | The non-sterile nurse who fetches things, handles paperwork and can use screens |
| **Scrub nurse** | The sterile nurse who hands instruments to the surgeon |
| **Tourniquet** | A cuff that stops blood flow to a limb during surgery. It must not stay on too long, so its time is tracked. |
| **TKR** | Total knee replacement |
| **Implant** | An artificial part placed in the body (for example, the knee components) |
| **Claude artifact** | A web page hosted on claude.ai that can use the signed-in person's Claude account for AI, voice and shared data |
| **API key** | A secret code that lets a separate website use Claude, paid per use. Not needed with the artifact approach. |
| **Speech-to-text** | Turning spoken words into written text |
| **AI model / LLM** | The AI that understands language and writes answers (here, Claude) |
| **Demo mode without AI** | A version of the app that works with pre-written answers, for when AI is unavailable or usage limits are hit |
| **Simulation mode** | Replays a scripted surgery at high speed, so the demo always works |
