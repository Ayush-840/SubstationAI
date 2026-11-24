# SubstationIQ XR — Product Requirements Document (AR / VR / 3D extension)

Version 1.0 · 24 Nov 2026 · Scope: the ISD capstone video evaluation (5 questions, individual video, max 10 min)
Repo reviewed: `Ayush-840/SubstationAI` @ `ee112af`

---

## 0. What changed in the repo (read first)

Your teammate (Aditya) replaced the backend between 12 and 21 Nov. This PRD is written against the **new** stack.

| Layer | Before | Now (in the repo today) |
|---|---|---|
| Backend | Python, FastAPI | Node.js, Express 4, ES modules (`backend/server.js`, `backend/src/`) |
| Database | SQLite/SQLAlchemy + MongoDB | PostgreSQL (Neon), Prisma 6, `pgvector` column declared |
| IDs / roles | integer ids, trainee/engineer/admin | UUID ids, roles `ADMIN` and `ENGINEER` |
| Catalog data | structured steps, limits, standards | **flat**: `Test.steps String[]`, `Test.limits String?`, no step types |
| Chat / RAG | working retrieval | **stub** (`src/stubs/getAnswer.js`) until Person 2 replaces it |
| Frontend | React 18, Vite, Tailwind | unchanged, still calls the old Python routes (`/api/catalog/*`, `/api/learn/*`, `/api/diagnosis`, `/api/auth/refresh`) |

Things that matter for this feature:

1. **Only login and `/me` were adapted** in the frontend. The Catalog, Procedures, Learn and Diagnosis pages call routes that do not exist on the Node API. The XR feature therefore talks to the Node API directly through its own small client and does not depend on those pages.
2. The flat `Test.steps` array cannot say *which 3D part a step acts on* or *what the user must do*. The XR feature needs a small extra table (section 7 of the TRD).
3. The old Python code (`backend/app`), the root `Dockerfile` and `render.yaml` are still Python-era. Not an XR problem, but a viva examiner will see it. Clean up in the last week.
4. `frontend/vercel.json` has a Content-Security-Policy with `default-src 'self'`. It blocks 3D decoder files and blob workers, so it must be edited for XR to work on Vercel (TRD section 10).

---

## 1. Why this feature exists

The ISD video asks five things: *what interactive experience, which tools, how interactions work, how visuals were built, and what was hard*. SubstationIQ today is a chatbot and a set of forms. Nothing in it can be shown as a 3D scene, a script driving objects, or a physics/animation behaviour. Without a 3D/AR/VR component the ISD video has nothing to demonstrate.

**Vision:** a browser-based virtual substation bay where a trainee performs a real maintenance test on 3D equipment, in the correct order, with safety rules enforced, and gets a verdict from the same limits the chatbot uses. It runs on a laptop (mouse), a phone (touch + AR), or a headset (VR).

**Why this fits the Ministry of Power problem (#262):** the problem statement asks for test steps, acceptable limits, safety guidelines and test equipment for transformers, breakers, instrument transformers, surge arresters and reactors. The 3D trainer makes exactly those four things *interactive* instead of text.

---

## 2. Users

| Persona | Needs | XR use |
|---|---|---|
| Trainee engineer | Learn a procedure without touching live plant | Walk through a test step by step, make mistakes safely |
| Field engineer | Refresh a rarely done test | Place the equipment in AR on a desk, check the order of steps and instruments |
| Admin / trainer | See who practised what and where they fail | Training statistics: completion rate, safety violations by step |
| Evaluator (ISD) | See a working interactive project in 10 minutes | Desktop mode needs no headset, so it is always demonstrable |

---

## 3. Goals and non-goals

**Goals**
- G1. A working interactive 3D experience that covers all five ISD questions with *your own* code and assets.
- G2. Works with **no headset**: desktop mode is the base. VR and AR are layered on top and degrade gracefully.
- G3. Uses the existing catalog and Result Checker limits so it is clearly part of SubstationIQ, not a separate toy.
- G4. Safety-first behaviour (isolation before testing) because that is the domain's core rule.
- G5. Testable: pure logic is unit-tested, scene is smoke-tested, every claim in the video can be shown.

**Non-goals**
- Photorealism, large environments, multiplayer, hand tracking, real instrument data.
- Replacing the chatbot or the REST API.
- Certified training. All numbers are *sample data*, labelled as such in the UI (the catalog already says so).

---

## 4. Feature list, ranked by marks per hour

Priority: **M** = must (build first), **S** = should, **C** = could. Question column = which ISD question the feature mainly earns marks for.

| # | Feature | Pri | Q | Why an evaluator cares |
|---|---|---|---|---|
| F1 | **3D Equipment Explorer** — transformer, circuit breaker, surge arrester (stretch: CT/PT, reactor). Orbit/zoom, exploded view slider, labelled part hotspots linked to the catalog. | M | 1, 2, 4 | Shows models, hierarchy, transformations, materials, lighting |
| F2 | **Guided Procedure Engine** — catalog test steps drive a state machine; current step highlights its target part; steps unlock in order. | M | 3 | Shows scripts, events, state management |
| F3 | **Safety Gate (isolation interlock)** — earthing and isolation steps must be completed before test steps unlock; wrong action logs a violation. | M | 3, 5 | Domain-specific logic, easy to demo, easy to explain |
| F4 | **Virtual Megger** — connect leads to terminals, choose test voltage, press TEST; reading follows a physical curve; IR at 1 min, 10 min, Polarisation Index computed; verdict from the Result Checker limits. | M | 3, 4, 5 | The signature feature: interaction + simulation + backend in one flow |
| F5 | **Session recording** — each run saved to PostgreSQL (steps done, violations, time, readings, mode) and shown on a "My training" panel. | M | 2, 5 | Proves frontend, API and database work together |
| F6 | **Live-zone clearance** — translucent hazard volumes around energised parts; entering one triggers alarm, red tint (and controller haptics in VR) and logs a violation. | S | 4, 5 | Collision/physics concept without a physics engine |
| F7 | **Breaker operation animation** — open/close with a damped motion, interlocks (cannot close the earth switch while the isolator is closed). | S | 3, 4 | Animation + state interlock |
| F8 | **VR mode (WebXR `immersive-vr`)** — ray pointer and grab with controllers; same scene, same engine. | S | 1, 3 | The "VR" in the brief; testable with an emulator |
| F9 | **AR place-and-inspect (WebXR `immersive-ar`)** — floor/table hit-test reticle, tap to place, pinch to scale, tap hotspots. Android Chrome. | S | 1, 3, 5 | The "AR" in the brief; honest limitation on iOS |
| F10 | **Admin training statistics** — completions per test, violations per step. | S | 2 | Reuses admin panel; cross-rubric value |
| F11 | **Find-the-part quiz** in 3D (raycast click), score stored. | C | 3 | Cheap extra interaction |
| F12 | **Ask about this part** — hotspot opens chat with equipment and part as context. Works fully once Person 2 replaces the chat stub. | C | 2 | Integration with RAG |

**Recommended cut for a safe submission:** F1 + F2 + F3 + F4 + F5 (desktop) → then F7 → F6 → F8 → F9. If time runs out after F5, you still have a complete, demonstrable project.

---

## 5. User flows

### 5.1 Primary flow (desktop, also used for the video)
1. Sign in → **XR Trainer** tab → choose equipment (Power Transformer) → choose test (Insulation Resistance & PI).
2. Scene loads. Panel on the left lists the steps; the current step is highlighted and its part glows.
3. Steps 1–2 are *safety*: open the isolator, close the earth switch (click the 3D handles). Skipping ahead shows "Isolate first" and records a violation.
4. Step 3: drag the megger lead to the HV bushing terminal, the earth lead to the tank earth stud.
5. Press **TEST**. The dial rises; the 1-min and 10-min readings are captured; PI is shown.
6. The reading is checked against the catalog limit → **PASS / FAIL stamp** (same component as the Result Checker).
7. Summary card: steps done, violations, time, score. Saved to the database.

### 5.2 VR
Same as above with controller rays (point + trigger) and grab for the leads. Hazard breach vibrates the controller.

### 5.3 AR
Open the page on an Android phone → **View in AR** → move the phone to find the floor → tap to place the equipment (scaled to a table-top 1:20 by default, 1:1 optional) → tap a hotspot to see the part name, function and the catalog test that touches it.

### 5.4 Admin
Admin → **Training stats**: table and bar chart of completions and violations per test.

---

## 6. Functional requirements with acceptance criteria

| ID | Requirement | Acceptance criterion (how you prove it in the video) |
|---|---|---|
| FR-1 | Load a GLB model for the selected equipment with named parts | Part names visible in the inspector list; clicking a hotspot shows the same name |
| FR-2 | Exploded view slider moves parts along per-part axes | Slider 0 → 1 separates parts smoothly; 0 returns to the original pose |
| FR-3 | Steps come from the API, not hard-coded | Changing a step text in the database changes the panel after reload |
| FR-4 | Steps cannot be completed out of order | Clicking the step-3 target before step 1 shows a warning and increments the violation counter |
| FR-5 | Isolation interlock | With the isolator closed the earth switch refuses to close and explains why |
| FR-6 | Megger reading follows R(t) = R∞·(1 − k·e^(−t/τ)) | The on-screen curve is monotonic; PI = R10 / R1 shown to 2 decimals |
| FR-7 | Verdict uses the catalog limit | Setting the megger "insulation condition" to *wet* produces FAIL; *dry* produces PASS |
| FR-8 | Run is stored | After finishing, `GET /api/training-sessions/me` returns the run; visible in the database console |
| FR-9 | Clearance volumes | Moving the camera/controller into the volume turns it red and logs one violation per entry (not per frame) |
| FR-10 | VR session | In the XR emulator, entering VR shows controller rays and the trigger operates the same handles |
| FR-11 | AR session | On an Android phone, the reticle appears on a surface and the model stays fixed in the room when the phone moves |
| FR-12 | Graceful fallback | On a device without WebXR the buttons are disabled with a reason, and desktop mode still works |

---

## 7. Non-functional requirements

| Area | Target |
|---|---|
| Frame rate | ≥ 30 fps on a mid-range phone, ≥ 60 fps on a laptop (measured, shown in Q5) |
| Model budget | ≤ 50k triangles per equipment model, ≤ 3 MB per GLB (Draco), textures ≤ 1024 px |
| Load | 3D code is a separate lazy-loaded chunk; the login page must not download it |
| Security | All XR API calls need the JWT; a user can read only their own sessions; admin stats are admin-only |
| Accessibility | Every 3D action also available from a keyboard/list control; reduced-motion setting disables animations |
| Honesty | Sample-data banner in the scene; "not a substitute for site procedure" footer |
| Browser | Latest Chrome/Edge (desktop, Android) are the supported targets; Safari/iOS: 3D yes, AR/VR no (documented) |

---

## 8. Success metrics (put real numbers in the video)

| Metric | Target |
|---|---|
| Time from login to first rendered model | < 5 s on broadband |
| Unit tests for the engine, megger and clearance code | ≥ 25 passing |
| End-to-end smoke test (headless browser loads scene, completes a run) | passes |
| Steps completed without violation in a demo run | 100 % |
| XR emulator session entered and exited without console errors | yes |

---

## 9. ISD evaluation mapping (the part that earns marks)

For each question: what to *say*, what to *show*, and which feature supplies it. Total video ≤ 10 min, so ≈ 2 min per question.

### Q1 — What did you create and why? (≈ 2 min)
- **Say:** "SubstationIQ XR is a WebXR training scene for substation maintenance. Objective: practise a test in the right order with safety rules. Main features: equipment explorer, guided procedure with isolation interlock, virtual megger, hazard zones, VR and AR modes. I personally built: *(list exactly your modules — see the team split in TRD §15)*."
- **Show:** the running scene — pick equipment, run the first 3 steps, show the verdict stamp. If you have a phone, 10 seconds of AR placement.
- **Features used:** F1, F2, F4, F8/F9.

### Q2 — Tools, structure, course concepts (≈ 2 min)
- **Say:** three.js through React Three Fiber (scene graph and render loop inside React), `@react-three/xr` for WebXR sessions, Zustand for state, Blender for model authoring and GLB export, Express + Prisma + PostgreSQL for catalog and session storage. Explain *why*: runs in any browser, no install, same codebase as the web app.
- **Show:** the `frontend/src/xr/` folder tree, the scene graph in the browser (three.js inspector or your part list), and one component you wrote (the procedure engine or the megger).
- **Course concepts to name:** scene graph and hierarchy, coordinate systems and transformations, materials (PBR), lighting, camera, animation, collision, event handling.
- **Features used:** all, mainly F1, F2, F5.

### Q3 — Interactions and behaviour (≈ 2 min)
- **Say:** input is pointer ray (mouse/touch/VR controller) → raycast → `onClick`/`onPointerDown` on named meshes → dispatch an action to the procedure store → store validates against the current step and the interlock rules → scene reacts (highlight moves, handle animates, panel updates). State lives in one store; the 3D scene is a pure view of that state.
- **Show:** one interaction end to end: click the earth switch, show the code in `engine.ts` that approves or rejects it, show the violation counter increase when you click out of order.
- **Features used:** F2, F3, F4, F7.

### Q4 — Visual elements and how they were built (≈ 2 min)
- **Say:** models modelled in Blender with named nodes (`part_bushing_hv_1`, `part_buchholz`), PBR materials, exported as Draco-compressed GLB; loaded with `useGLTF`; each named node is bound to a hotspot and to a catalog step. Transformations: exploded view animates each part along its own axis with a smooth interpolation; scale in AR. Lighting: hemisphere + directional with shadows, environment map for the porcelain and metal. Animation: breaker open/close clip. Physics/collision: hazard volumes tested with box/sphere intersection each frame. Testing: unit tests plus the headless render test plus the XR emulator.
- **Show:** Blender file (outliner with named parts, material, export dialog), the GLB in the scene, a material or light value changed live, the hazard volume being triggered.
- **Features used:** F1, F6, F7.
- **Be truthful:** if you did not model in Blender, say the models were built procedurally in three.js (primitives, lathe geometry) and show that code instead. Evaluators grade what you actually used.

### Q5 — Challenges, debugging, completeness (≈ 2 min)
- **Say:** hardest feature = the interlock + megger flow (state, timing and the database call have to agree). Problems: CSP blocking the decoder, WebXR not available on iOS, per-frame collision firing many events, backend model not storing step targets. How resolved: self-hosted decoder and CSP change, feature detection with fallback, "enter/exit" edge detection, new `ar_steps` table. How tested: unit tests, headless smoke test, emulator, real phone FPS. Honest limitations: sample data, simulated readings, AR Android-only, five models not equal in detail.
- **Show:** the failing then passing test, the CSP console error before and after, the FPS readout, the limitations list slide *after* the live demo (not instead of it).
- **Features used:** F3, F4, F6, F9.

### Coverage check

| Evaluation hint in the brief | Where covered |
|---|---|
| "Demonstrate your actual project… Slides alone are not sufficient" | Live scene in every question |
| "Focus on the work you personally completed" | Per-person module split (TRD §15) and Q1 ownership statement |
| "Project structure inside the development tool" | Q2: editor tree + Blender outliner |
| "transformations, materials, lighting, animation, or physics" | Q4: F1 (transform, material, light), F7 (animation), F6 (collision) |
| "How did you test" | Q4/Q5: unit tests, headless smoke test, emulator, device FPS |
| "How complete and stable… limitations" | Q5: honest list |

---

## 10. Release plan

| Release | Contents | Result |
|---|---|---|
| **R1 — Desktop core** | F1, F2, F3, F4, F5 | Complete, demonstrable ISD project |
| **R2 — Depth** | F7, F6, F10 | Animation, collision, stats |
| **R3 — Immersive** | F8, F9 | VR and AR modes |
| **R4 — Nice to have** | F11, F12 | Quiz, chat link |

Day-by-day plan is in TRD §16.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Frontend calls routes the Node API does not have | Pages 404, demo breaks | XR uses its own client against the real Node routes; agree an API contract with Aditya (TRD §8) |
| No headset available for the demo | VR cannot be shown live | Desktop mode is the base; record VR with the Meta Immersive Web Emulator (browser extension) and say so |
| iOS has no WebXR AR | Part of the team cannot test AR | State it; demo on one Android phone |
| Blender models take too long | Q4 weak | Build procedural models first (works in 1 day), swap in Blender GLBs for the hero model only |
| CSP blocks decoder/workers on Vercel | Black canvas in production | Self-host Draco under `/public`, update CSP (TRD §10), test the deployed URL |
| Three people, one video each | Overlapping content | Each person owns a different module and demos only that module (TRD §15) |
| Render free tier cold start during the video | 30–60 s stall | Wake the API before recording; keep the scene able to run from a cached procedure when offline |

---

## 12. Open questions for you and your team

1. Which person owns which module? (Suggested split in TRD §15.)
2. Does your course explicitly count three.js/WebXR as an interactive-project tool? The brief lists WebXR, so it should, but confirm with the instructor.
3. Did you actually use Blender? Decide before recording so Q4 is truthful.
4. Is there an Android phone with ARCore for the AR demo?
5. Will Aditya add the `ar_steps` and `training_sessions` tables, or do you add them yourself (a small Prisma migration)? Either is fine, but do it in one agreed PR.

---

## 13. Safety and honesty note

The simulated readings and the hazard distances are teaching samples. The scene must always show the existing catalog disclaimer. Do not describe the simulator as a measuring tool or as certified training in the video.
