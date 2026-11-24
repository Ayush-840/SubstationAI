# SubstationIQ XR — Technical Requirements Document

Version 1.0 · 24 Nov 2026 · Companion to `PRD_ARVR.md`
Repo reviewed: `Ayush-840/SubstationAI` @ `ee112af` (Node + Express + Prisma + PostgreSQL backend)

**What was verified, not assumed** (on a scratch copy of the repo's `frontend/`):
- `three@0.170.0`, `@react-three/fiber@8.18`, `@react-three/drei@9.122`, `@react-three/xr@6.6`, `zustand@4.5` install next to React 18 + Vite 5 with no peer errors.
- `tsc --noEmit` passes and `vite build` succeeds with a Canvas + `createXRStore` + `enterVR/enterAR` page.
- That scene renders in headless Chromium (WebGL context created, `navigator.xr` present, secure context, no console errors).
- The engine, megger and clearance code in `xr-starter/` passes 11 unit tests (included with this document).
- drei's `useGLTF` loads its Draco decoder from `https://www.gstatic.com/draco/...` by default; the repo's CSP forbids that origin (section 10).
- Baseline: the main JS bundle is 435 kB (121 kB gzip) before any 3D code. Three.js adds a large chunk, so the XR route must be lazy-loaded.

---

## 1. Current-state audit (what the XR work builds on)

| Area | Fact in the repo | Consequence for XR |
|---|---|---|
| API | Express routes: `/api/auth` (login, register, me, password), `/api/equipment`, `/api/tests`, `/api/documents`, `/api/chat`, `/api/admin` (stats, users) | XR adds `/api/xr/*` in the same style |
| Auth | JWT only (`JWT_EXPIRES_IN` default 7d), no refresh route; error body is `{ "error": "..." }` | The frontend `client.ts` still tries `/api/auth/refresh` and reads `detail`; XR calls must handle `{error}` |
| IDs | UUID strings | Frontend types say `id: number`; XR types use `string` |
| Roles | `ADMIN`, `ENGINEER` | No trainee role; XR is open to both, stats to `ADMIN` |
| Catalog model | `Test { steps String[]; limits String?; safety String[]; tools String[]; ... }` | No step type, no 3D target, no numeric limits → new tables (section 7) |
| Frontend routes | Pages call `/api/catalog/*`, `/api/learn/*`, `/api/diagnosis`, `/api/tools/check-result`, `/api/fault-logs` | These 404 on the Node API. XR must not depend on them |
| Frontend login | `auth.tsx` already accepts `{ token, user }` and normalises the user | Good: XR can rely on `api.get/post` from `client.ts` after login |
| Cleanup | Python `backend/app`, root `Dockerfile`, `render.yaml`, `backend/tests/__pycache__` are stale | Remove before submission (not XR work) |
| Deploy | Root `vercel.json` uses `experimentalServices`; `frontend/vercel.json` also exists with a CSP naming `substationiq-api.onrender.com` | Decide one deployment layout, then fix the CSP once (section 10) |

**Data inconsistency to tell your team:** the catalog YAML (and IEEE 43 / C57.152) defines **Polarisation Index = R10 min / R1 min**, with limits PI ≥ 1.5 and IR(1 min) ≥ 1000 MΩ. Aditya's Node seed says "PI = IR60/IR15", which is the *dielectric absorption ratio*, not PI. The XR feature uses R10/R1. Fix the seed text so the chatbot, the Result Checker and the 3D trainer agree.

---

## 2. Architecture

```
                 Browser (React 18 + Vite, route /xr, lazy chunk)
 ┌──────────────────────────────────────────────────────────────────┐
 │  XrTrainer page                                                  │
 │   ├─ UI panels (React DOM): steps, verdict, summary, mode buttons│
 │   └─ <Canvas> (react-three-fiber)                                │
 │        └─ <XR store>  ── WebXR session (desktop | VR | AR)       │
 │             ├─ EquipmentModel (GLB, named nodes)                 │
 │             ├─ Hotspots / ExplodeController                      │
 │             ├─ Megger (leads, dial, curve)                       │
 │             ├─ HazardZones  ── ClearanceMonitor (pure)           │
 │             └─ pointer events ─▶ dispatch(UserAction)            │
 │                                       │                          │
 │   Zustand store ◀── engine.apply() (pure reducer, unit-tested)   │
 │        │  state: current step, devices, violations, readings     │
 └────────┼─────────────────────────────────────────────────────────┘
          │ REST (JWT)
          ▼
 Express API ── /api/xr/scenes/:equipmentId   → model URL, parts, zones
             ── /api/xr/tests/:testId/script  → typed steps + numeric limits
             ── POST /api/xr/sessions         → save a run
             ── GET  /api/xr/sessions/me      → my history
             ── GET  /api/admin/xr-stats      → trainer statistics
          ▼
 PostgreSQL (Neon) via Prisma: ar_scenes, ar_scripts, ar_steps, training_sessions
```

**Principle:** the 3D scene is a *view* of one state object. All rules (order, interlocks, scoring, megger maths, hazard entry) live in pure TypeScript functions with no WebGL import, so they are unit-testable and explainable in Q3 and Q5.

---

## 3. Technology choices and reasons (Q2 answers)

| Choice | Why | Alternative rejected |
|---|---|---|
| three.js via **React Three Fiber 8** | Scene graph, materials, lights, raycasting; declarative inside the existing React app; v8 targets React 18 (v9 needs React 19) | Unity WebGL (large build, separate project), Babylon (no existing React fit) |
| **@react-three/xr 6** | `createXRStore`, `enterVR/enterAR`, controller rays, `XRHitTest`, `XRDomOverlay`, feature detection hooks | Hand-written WebXR session code (more bugs, no gain) |
| **drei 9** | `useGLTF`, `OrbitControls`, `Html`, `Environment`, `Bounds` | Custom loaders |
| **Zustand 4** | Tiny store that both React UI and the render loop can read; works outside React for tests | Redux (heavy), Context (re-renders the whole scene) |
| **Blender → GLB (Draco)** | Real asset pipeline: named nodes, PBR materials, animation clips | Procedural-only models (allowed as a fallback, see 5.4) |
| **Vitest** (already in the frontend) | Pure-logic tests | Jest (second runner) |
| Express + Prisma + PostgreSQL | Already the project backend | — |

Install (frontend):

```bash
cd frontend
npm i three@0.170.0 @react-three/fiber@8 @react-three/drei@9 @react-three/xr@6 zustand@4
npm i -D @types/three@0.170.0
```

Pin `three` and `@types/three` to the same version; R3F 8 and drei 9 are the pair that supports React 18.

---

## 4. Frontend module layout

```
frontend/
  public/
    models/            transformer.glb  breaker.glb  arrester.glb   (Draco, ≤ 3 MB each)
    draco/             draco_decoder.js  draco_decoder.wasm  draco_wasm_wrapper.js
  src/
    xr/
      types.ts         step, action, run state, violation types
      engine.ts        PURE reducer: apply(state, steps, action, now), interlocks, score
      megger.ts        PURE: R(t), PI, temperature correction, verdict
      clearance.ts     PURE: ClearanceMonitor (entry detection)
      store.ts         Zustand store wrapping engine + selected test/scene
      api.ts           typed calls to /api/xr/*
      scene/
        SceneRoot.tsx          Canvas, lights, environment, XR provider
        EquipmentModel.tsx     useGLTF, binds named nodes to handlers
        Hotspots.tsx           labelled markers, raycast hover/click
        ExplodeController.tsx  slider → per-part translation
        MeggerRig.tsx          leads, dial, curve
        HazardZones.tsx        translucent spheres + monitor
        DeviceHandles.tsx      isolator / earth switch handles + animation
      modes/
        XrButtons.tsx          enter VR / AR with feature detection
        ArPlacement.tsx        XRHitTest reticle, place, scale
      ui/
        StepPanel.tsx  SummaryCard.tsx  SampleDataBanner.tsx
      __tests__/       engine.test.ts megger.test.ts clearance.test.ts
    pages/
      XrTrainer.tsx    (default export, lazy)
```

Wire-up in `App.tsx` (the tab list and `TAB_PATHS` already follow this pattern):

```tsx
const XrTrainer = lazy(() => import('./pages/XrTrainer'))
// TABS:      { id: 'xr', label: 'XR Trainer' }
// TAB_PATHS: xr: '/xr'
// <Route path="/xr" element={<Suspense fallback={<p>Loading 3D…</p>}><XrTrainer /></Suspense>} />
```

`lazy` keeps three.js out of the login bundle (baseline 121 kB gzip).

---

## 5. Scene and asset specification

### 5.1 Units and conventions
- 1 unit = 1 metre. Y up. Models authored at 1:1 and scaled at runtime (AR default 1:20).
- Node naming: `part_<name>` for interactive parts, `dev_<name>` for switchable devices, `term_<name>` for connection terminals. Example: `part_buchholz`, `part_bushing_hv_1`, `dev_isolator`, `dev_earth_switch`, `term_hv`.
- Origin of each model at floor centre. Apply transforms in Blender before export so scale is 1.

### 5.2 Budgets
| Item | Budget |
|---|---|
| Triangles per equipment model | ≤ 50 000 |
| Scene total | ≤ 150 000 |
| Texture size | ≤ 1024 px, one atlas per model |
| GLB size | ≤ 3 MB after Draco |
| Lights | 1 hemisphere + 1 directional (shadow map 2048), environment map low-res |
| Draw calls | ≤ 150 |

### 5.3 Concepts the scene demonstrates (Q4 vocabulary)
| Course concept | Where in the project |
|---|---|
| Scene graph, parent/child | Equipment root → parts; leads parented to controller/pointer while dragged |
| Transformations (T/R/S) | Exploded view = per-part translation along its axis; AR scale; handle rotation |
| Materials (PBR) | Porcelain (rough 0.3), metal (metalness 0.9), oil-painted tank; emissive for the "current step" highlight |
| Lighting | Hemisphere ambient + directional with shadows; environment reflection |
| Camera | Orbit camera on desktop; XR camera = headset/phone pose |
| Animation | Switch handle open/close (damped), megger dial needle; optional Blender clip `breaker_open` |
| Collision / physics | Hazard spheres: distance test each frame with entry detection (section 9) |
| Events / input | Pointer events through raycasting; XR controller rays |
| State management | One store, pure reducer |

### 5.4 Fallback if Blender time is short
Build the three models procedurally (boxes, cylinders, `LatheGeometry` for bushings and arrester sheds) inside `EquipmentModel.tsx` with the same node names. Use Blender for **one** hero model (circuit breaker) and say exactly that in the video.

### 5.5 Blender pipeline
1. Model with low-poly primitives, apply modifiers, apply scale (`Ctrl+A`).
2. Name objects per 5.1; parent small parts to their group empties.
3. One Principled BSDF material per surface type; bake nothing at first.
4. Export glTF 2.0 (`.glb`), tick "Apply Modifiers", "+Y Up", include animations.
5. Compress: `npx gltf-transform optimize in.glb out.glb --compress draco --texture-size 1024`.
6. Place in `frontend/public/models/`.

---

## 6. State machine and interaction logic (Q3)

Full, tested code is in `xr-starter/` (`types.ts`, `engine.ts`, `megger.ts`, `clearance.ts`, `__tests__/xr.test.ts`). Copy the four source files to `frontend/src/xr/` and the test to `frontend/src/xr/__tests__/`.

### 6.1 Types (summary)
```ts
type StepType = 'safety' | 'prep' | 'action' | 'record'
type ActionKind = 'operate' | 'connect' | 'measure' | 'inspect'
interface XrStep { no; type; text; target /* GLB node */; action; value? }
interface UserAction { kind; target; value? }
interface RunState { current; done[]; violations[]; startedAt; finishedAt?; devices: Record<string,string> }
```

### 6.2 Reducer rules (`engine.apply`)
1. A finished run accepts nothing.
2. **Interlock first:** earth switch cannot close unless the isolator is open; isolator cannot close while the earth switch is closed. A breach is rejected, logged as `interlock`, and the device does not move.
3. `inspect` on a part that is not the current target is allowed (looking is not an error).
4. If the action does not match the current step (kind, target, value) → rejected, logged as `out_of_order`.
5. Otherwise accepted: device state updated, step marked done, `current++`, run finishes after the last step.
6. Score = completion % − 10 per violation (floor 0).

### 6.3 Event flow for one click
```
pointer ray hits mesh "dev_earth_switch"
  → onClick handler in DeviceHandles.tsx
  → store.dispatch({ kind:'operate', target:'earth_switch', value:'closed' })
  → engine.apply(...)      (pure)
  → ok?  handle animates to "closed", next step highlights
  → no?  handle shakes, toast shows reason, violation counter +1
```

### 6.4 Input mapping
| Intent | Desktop | Touch | VR controller | AR |
|---|---|---|---|---|
| Look | Orbit (drag) | One-finger drag | Head pose, thumbstick/teleport | Walk around |
| Zoom / scale | Wheel | Pinch | Move closer | Pinch |
| Select / operate | Click | Tap | Ray + trigger | Tap |
| Grab lead | Drag | Drag | Grip / trigger-hold | — (tap to connect) |
| Explode | Slider | Slider | DOM overlay not available in VR → thumbstick up/down | Slider in `XRDomOverlay` |
| Accessibility | Keyboard: `Tab` through step list, `Enter` to perform the highlighted step's action | Same | — | — |

### 6.5 Megger simulation (F4)
Absorption model: `R(t) = R∞ · (1 − k · e^(−t/τ))`, τ = 240 s. Parameters per condition (teaching samples):

| Condition | R∞ (MΩ) | k | R1 (60 s) | R10 (600 s) | PI = R10/R1 | Verdict (IR ≥ 1000, PI ≥ 1.5, good ≥ 2.0) |
|---|---|---|---|---|---|---|
| dry | 5000 | 0.80 | 1885 | 4672 | 2.48 | PASS |
| damp | 2500 | 0.55 | 1429 | 2387 | 1.67 | MARGINAL |
| wet | 300 | 0.10 | 277 | 298 | 1.08 | FAIL |

(These are the values the unit tests assert. The first draft of the damp parameters gave PI 1.48 and failed the test, which is a good Q5 debugging story.)

Temperature correction: `R20 = R_T · 2^((T−20)/10)` (rule of thumb, say so). The limits `r1MinMOhm` and `piMin` come from the catalog row (`ar_scripts.limits`), not from code constants.

In the scene: pressing TEST plays the reading over a compressed time (e.g. 10 minutes in 20 seconds), draws the curve with `<Line>`, and reveals R1, R10 and PI. Then `POST` the result to the session (section 8) and show the stamp.

---

## 7. Database (Prisma, PostgreSQL)

Add to `backend/prisma/schema.prisma` in Aditya's style (uuid ids, `@@map` snake_case). One migration: `npx prisma migrate dev --name xr_training`. Coordinate with Aditya so there is one PR and one migration.

```prisma
enum XrMode {
  DESKTOP
  VR
  AR
}

model ArScene {                 // one 3D scene per equipment class
  id          String    @id @default(uuid())
  equipment   Equipment @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  equipmentId String    @unique
  modelUrl    String                       // "/models/transformer.glb"
  version     Int       @default(1)
  parts       Json                         // [{node,label,description,explodeAxis:[x,y,z],explodeDist}]
  zones       Json                         // [{id,label,center:[x,y,z],radius}]  (sample clearances)
  @@map("ar_scenes")
}

model ArScript {                // one script per test: numeric limits + ordered steps
  id     String   @id @default(uuid())
  test   Test     @relation(fields: [testId], references: [id], onDelete: Cascade)
  testId String   @unique
  limits Json                              // {"r1MinMOhm":1000,"piMin":1.5}
  steps  ArStep[]
  @@map("ar_scripts")
}

model ArStep {
  id       String   @id @default(uuid())
  script   ArScript @relation(fields: [scriptId], references: [id], onDelete: Cascade)
  scriptId String
  stepNo   Int
  type     String                          // safety | prep | action | record
  target   String                          // GLB node, e.g. "dev_earth_switch"
  action   String                          // operate | connect | measure | inspect
  value    String?
  text     String                          // may copy Test.steps[stepNo-1]
  @@unique([scriptId, stepNo])
  @@map("ar_steps")
}

model TrainingSession {
  id          String    @id @default(uuid())
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String
  test        Test      @relation(fields: [testId], references: [id])
  testId      String
  mode        XrMode
  startedAt   DateTime
  finishedAt  DateTime?
  stepsDone   Int
  stepsTotal  Int
  violations  Json      @default("[]")     // [{code,step,target,at}]
  readings    Json?                        // {condition,r1,r10,pi}
  verdict     String?                      // PASS | MARGINAL | FAIL
  score       Int
  createdAt   DateTime  @default(now())
  @@index([userId, createdAt])
  @@index([testId])
  @@map("training_sessions")
}
```

Add the back-relations: `User.trainingSessions TrainingSession[]`, `Test.arScript ArScript?`, `Test.trainingSessions TrainingSession[]`, `Equipment.arScene ArScene?`.

**Seed:** add `prisma/seed-xr.js` that, for "Power Transformer" and the IR/PI test, inserts the scene row, the script with `limits {"r1MinMOhm":1000,"piMin":1.5}` and six steps:

| No | Type | Text | Target | Action | Value |
|---|---|---|---|---|---|
| 1 | safety | Open the isolator and confirm de-energised | `dev_isolator` | operate | open |
| 2 | safety | Close the earth switch | `dev_earth_switch` | operate | closed |
| 3 | prep | Connect the megger HV lead to the bushing terminal | `term_hv` | connect | — |
| 4 | prep | Connect the earth lead to the tank earth stud | `term_earth` | connect | — |
| 5 | action | Run the 10-minute test | `megger` | measure | — |
| 6 | record | Record the corrected values | `panel_record` | inspect | — |

Normalisation note (DBMS rubric): steps are rows, not an array, so they can be queried and indexed; scene `parts` and `zones` are JSONB because they are only ever read whole.

---

## 8. API contract

All routes require the existing `requireAuth`. Errors use the existing `{ "error": "message" }` shape. Validation with zod through the existing `validate` middleware. Add `backend/src/routes/xr.js` and mount `app.use("/api/xr", xrRoutes)`.

| Method | Path | Role | Response |
|---|---|---|---|
| GET | `/api/xr/scenes/:equipmentId` | any | `{ scene: { modelUrl, version, parts, zones } }` |
| GET | `/api/xr/tests/:testId/script` | any | `{ test: { id, name }, limits, steps: [{ no, type, text, target, action, value }] }` |
| POST | `/api/xr/sessions` | any | `201 { session }` |
| GET | `/api/xr/sessions/me?limit=20` | any | `{ sessions: [...] }` (own only) |
| GET | `/api/admin/xr-stats` | ADMIN | `{ perTest: [{ testId, name, runs, avgScore, avgViolations }], violationsByStep: [...] }` |

`POST /api/xr/sessions` body (zod):

```js
z.object({
  testId: z.string().uuid(),
  mode: z.enum(["DESKTOP", "VR", "AR"]),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  stepsDone: z.number().int().min(0).max(50),
  stepsTotal: z.number().int().min(1).max(50),
  violations: z.array(z.object({
    code: z.enum(["out_of_order", "interlock", "hazard_zone"]),
    step: z.number().int(), target: z.string().max(60), at: z.number().int().min(0),
  })).max(200),
  readings: z.object({ condition: z.enum(["dry","damp","wet"]), r1: z.number(), r10: z.number(), pi: z.number() }).optional(),
})
```

Server rules: `stepsDone ≤ stepsTotal`; recompute `score` and `verdict` on the server from `readings` and the stored `limits` (never trust the client's verdict); `userId` comes from the JWT, never from the body. Training is low-stakes, so this is validation, not anti-cheat.

**Frontend client:** reuse `api` from `src/api/client.ts` (it adds the Bearer token). Because the Node API returns `{error}` and the client's `formatError` already checks `body.error.message`/`body.message` but not a plain string `body.error`, add one line there: `if (typeof body?.error === 'string') return body.error`. Also remove or guard the `/api/auth/refresh` call (the Node API has no such route; with a 7-day token this only matters at expiry).

---

## 9. XR modes in detail

### 9.1 Feature detection (F12 fallback)
```tsx
import { useXRSessionModeSupported, ShowIfSessionModeSupported } from '@react-three/xr'
// <button disabled={!vrOk} title={!vrOk ? 'WebXR VR not available on this device' : ''}>Enter VR</button>
```
Use `useXRSessionModeSupported('immersive-vr')` and `('immersive-ar')`. All three exports exist in the installed version. Buttons call `store.enterVR()` / `store.enterAR()` from `createXRStore()`. Always render a reason when disabled.

### 9.2 VR
- `<XR store={store}>` gives controller ray pointers; R3F `onClick` / `onPointerDown` fire from the ray, so the same handlers serve mouse, touch and VR.
- Haptics on a hazard entry: use the controller's gamepad `hapticActuators` if present, inside a `try/catch`.
- DOM panels do not exist in VR. Render the step text as an `<Html transform>` or a text mesh attached to the camera rig; keep the step list readable at 1.5 m.

### 9.3 AR (Android Chrome with ARCore)
- Enter with `store.enterAR()`; request the `hit-test` feature.
- `XRHitTest` (or `useXRHitTest`) drives a reticle mesh; tap places the equipment group at the hit pose; pinch scales (clamp 0.02–1.0).
- Optional `dom-overlay` via `XRDomOverlay` for the step list and explode slider.
- iOS Safari has no WebXR AR. Say so; the page shows the 3D desktop mode there. This is a documented limitation for Q5, not a bug.

### 9.3b Hazard zones (F6)
```ts
const monitor = useMemo(() => new ClearanceMonitor(scene.zones.map(z => ({ id:z.id, center:z.center, radius:z.radius }))), [scene])
useFrame(({ camera }) => {
  const p = camera.getWorldPosition(tmp).toArray() as [number, number, number]
  for (const id of monitor.update(p)) dispatchViolation({ code:'hazard_zone', target:id })
})
```
`ClearanceMonitor` reports a zone only on **entry** and re-arms after exit (tested). On desktop the "body" is the orbit camera; in VR it is the headset and controllers. Zone radii are sample values from a config row, labelled as such.

### 9.4 Testing VR with no headset
Install the **Immersive Web Emulator** Chrome extension (Meta). It adds emulated headset and controllers to the DevTools panel and lets you enter `immersive-vr` on a laptop. Record the emulator window for the VR part of the video and say it is emulated. Test real VR only if a Quest is available.

---

## 10. Security, CSP and deployment

### 10.1 CSP changes (required, otherwise the canvas is black on Vercel)
Current `frontend/vercel.json` CSP: `default-src 'self'; connect-src 'self' https://substationiq-api.onrender.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; ...`

Problems for XR:
- drei's `useGLTF` fetches the Draco decoder from `gstatic.com` (verified in the package source) → blocked.
- Draco decoding uses WebAssembly and a blob worker → need `'wasm-unsafe-eval'` and `worker-src blob:`.
- Textures from GLB are created as blob URLs → `img-src blob:`.

Fixes:
1. Self-host the decoder: copy `node_modules/three/examples/jsm/libs/draco/{draco_decoder.js,draco_decoder.wasm,draco_wasm_wrapper.js}` to `frontend/public/draco/` and call `useGLTF.setDecoderPath('/draco/')` once.
2. Extend the CSP:
```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
img-src 'self' data: blob:;
connect-src 'self' blob: https://<YOUR-REAL-API-HOST>;
style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'
```
3. Add `Permissions-Policy: xr-spatial-tracking=(self), camera=(self)`.
4. The host in `connect-src` must be your real API origin. The hard-coded `substationiq-api.onrender.com` is a guess from the docs; use the URL Render gives you (also the earlier "Vercel looks different from local" cause: the same CSP also blocks the inline theme-init script in `index.html`; move that script to `public/theme-init.js` and load it with `<script src>`).

### 10.2 Other
- WebXR requires HTTPS (Vercel provides it; `localhost` counts as secure for development).
- AR asks for camera/sensor permission; handle denial with a visible message.
- API: per-user data isolation (`where: { userId: req.user.id }`), admin stats behind `requireRole("ADMIN")`, body limit already 1 MB, rate limit via the existing `generalLimiter`.
- Model files are static public assets: no user uploads in XR, so no new upload surface.
- Do not commit `.env`; Neon credentials stay private.

### 10.3 Performance
`React.lazy` route, GLB Draco, one atlas per model, `<Canvas dpr={[1, 2]} frameloop="demand">` on desktop and `"always"` while in XR or animating, `<Bounds>`/instancing for repeated sheds on the arrester, dispose geometries on unmount. Measure with `<Stats />` and report the real numbers.

---

## 11. Testing strategy (Q4 "how did you test" and Q5)

| Layer | Tool | What | Status |
|---|---|---|---|
| Pure logic | Vitest | engine ordering, interlocks, score, megger curve monotonic, PI, verdict, temperature correction, clearance entry/exit | **11 tests written and passing** in `xr-starter/` |
| Scene smoke | Playwright (installed in this workspace) or `puppeteer-core` (already a devDependency) with `--use-gl=swiftshader` | Loads `/xr`, canvas exists, WebGL context created, no console errors, one scripted run completes | Proven on the probe page; extend to the real page |
| API | `node --test` + `fetch` against a test database (no new dependency) | auth required (401), own sessions only, admin-only stats (403), zod rejects bad body (400/422), server recomputes verdict | to write |
| XR manual | Immersive Web Emulator | enter/exit VR, ray click operates handles, no errors | checklist below |
| Device | Android phone + Chrome | AR reticle, placement stable, FPS | checklist below |
| Performance | `<Stats />` + Chrome Performance panel | fps, draw calls, triangles | record numbers |

### 11.1 Test case table (show this in Q5)
| ID | Case | Expected |
|---|---|---|
| T1 | Click the earth switch first | Rejected, interlock message, violation +1, device unchanged |
| T2 | Perform steps 1–6 in order | Run finishes, score 100, no violations |
| T3 | Click the HV terminal at step 1 | `out_of_order`, step unchanged |
| T4 | Megger with *wet* condition | PI ≈ 1.08, verdict FAIL |
| T5 | Move camera into a hazard sphere and stay 5 s | Exactly one `hazard_zone` violation |
| T6 | Leave and re-enter | Second violation |
| T7 | Refresh mid-run | Run restarts cleanly (no ghost state) |
| T8 | Open `/xr` on a browser with no WebXR | VR/AR buttons disabled with reason; desktop works |
| T9 | `POST /api/xr/sessions` without a token | 401 |
| T10 | Another user's session in `GET /sessions/me` | Never returned |
| T11 | Draco decoder request on Vercel | Same-origin 200, no CSP error |

### 11.2 Manual checklists
**VR (emulator):** extension on → `/xr` → Enter VR → both controllers visible → ray hits a handle → trigger operates it → hazard breach logs a violation → Exit VR returns to desktop without a console error.
**AR (Android):** HTTPS URL → Enter AR → permission granted → reticle on floor → tap places model → walk around, model stays fixed → pinch scales → hotspot tap shows card → exit.

---

## 12. Q5 material: problems you will genuinely hit (keep a log as you go)

Do not invent these; keep real notes during the build. These are the ones this stack makes likely:

| Likely problem | Cause | Fix |
|---|---|---|
| Black canvas on Vercel, fine locally | CSP blocks decoder/worker (section 10) | Self-host Draco, extend CSP |
| Violation spam while inside a hazard zone | Distance test runs 60×/s | Entry detection (`ClearanceMonitor`) |
| Model appears 100× too big or tiny | Blender scale not applied | Apply transforms, export at 1 unit = 1 m |
| Clicks pass through to the model behind | Raycast hits every mesh | `e.stopPropagation()` in handlers |
| UI re-renders every frame | Reading the store in `useFrame` through a hook | Read with `store.getState()` inside `useFrame` |
| iOS cannot enter AR | No WebXR AR in Safari | Feature detection and honest limitation |
| Login works, catalog pages 404 | Frontend calls Python-era routes | XR uses `/api/xr/*`; list the remaining pages as known gaps |
| First draft "damp insulation" parameters gave PI 1.48 (verdict FAIL, expected MARGINAL) | Parameter choice | The unit test caught it; tuned to PI 1.67 |

---

## 13. Definition of done

- [ ] `npm run typecheck` and `npm run build` pass in `frontend/`
- [ ] `npm test` passes (≥ 25 tests including the 11 provided)
- [ ] `/xr` loads as a separate chunk; login page does not download three.js
- [ ] Draco decoder served from `/draco/`; CSP updated; deployed scene renders on Vercel
- [ ] Prisma migration applied to the shared Neon database; seed script run
- [ ] A full run (6 steps) saves a `training_sessions` row visible in Prisma Studio
- [ ] VR entered and exited in the emulator without console errors
- [ ] AR placement shown on one Android phone (or the limitation stated)
- [ ] Sample-data banner and disclaimer visible in the scene
- [ ] README section "XR Trainer" with run instructions and screenshots

---

## 14. Video recording plan (10 minutes, individual)

Record the screen with your voice. Keep each question to about 2 minutes. Never show only slides.

| Time | Question | On screen |
|---|---|---|
| 0:00–2:00 | Q1 | App → XR Trainer → pick transformer → run steps 1–3 live → verdict stamp. 10 s of AR or VR clip. State your own modules |
| 2:00–4:00 | Q2 | Editor: `frontend/src/xr/` tree, `package.json` deps, Blender outliner, one component (`engine.ts` or `MeggerRig.tsx`). Say how scene, store and API connect |
| 4:00–6:00 | Q3 | Click the earth switch out of order → violation; open `engine.ts` `apply()`; show the store and the handler. Show the state after a refresh |
| 6:00–8:00 | Q4 | Blender model + node names; the GLB in the scene; change a material colour and a light intensity live; drag the explode slider; hazard zone trigger; show the test run (`npm test` green) |
| 8:00–10:00 | Q5 | Hardest feature (interlock + megger + save); the CSP error then fix; test table; FPS number; honest limitations (sample data, iOS AR, simulated readings) |

Checklist: wake the Render API and open the app once before recording; use a fresh browser profile with no extensions except the emulator; pre-create the account; keep the terminal and the database console ready; export at 1080p; upload with "anyone with the link" access and open the link in a private window to confirm.

---

## 15. Team split (each person needs their own demonstrable work)

The brief says each student submits an individual video about *the work they personally completed*, so three people should not all demo the same module. Suggested split (adjust to who is who; the interfaces below keep the work separable):

| Owner | Modules | Strongest ISD answers | Interface they provide |
|---|---|---|---|
| **A — Scene and assets** | Blender models, `EquipmentModel`, `Hotspots`, `ExplodeController`, lighting/materials, performance, CSP + Draco | Q2, Q4 | GLB files with agreed node names; `parts`/`zones` JSON |
| **B — Interaction and logic** | `types`, `engine`, `store`, `DeviceHandles`, `StepPanel`, `MeggerRig` + `megger.ts`, `ClearanceMonitor`, unit tests | Q3, Q5 | `dispatch(action)`, `useRun()` |
| **C — Immersive modes and backend** | `XrButtons`, VR controllers, `ArPlacement`, Prisma tables, `/api/xr/*`, seed, admin stats, API tests | Q1, Q3 (AR/VR), Q5 | REST contract in section 8 |

Everyone: read all three sections, commit under your own account daily, and mention in Q1 which modules are yours. The interfaces are small on purpose, so one person's unfinished work never blocks another's demo (mock the API with a JSON file; mock the model with a box).

---

## 16. Build plan (days, not dates; start whenever you begin)

| Day | Deliverable | Verify |
|---|---|---|
| 1 | Install deps, `/xr` lazy route with an empty Canvas, orbit camera, lights; copy `xr-starter` files; `npm test` green | Page renders; 11 tests pass |
| 2 | Procedural models for transformer and breaker with the agreed node names; hotspots with labels | Click a hotspot → label |
| 3 | Exploded view slider; materials; shadows | Slider moves parts and returns |
| 4 | Store + `StepPanel` with hard-coded JSON steps; handles for isolator and earth switch; interlock | Tests T1–T3 pass by hand |
| 5 | Prisma tables, migration, seed; `GET /scenes`, `GET /script`; frontend loads steps from the API | Change a step in DB → UI changes |
| 6 | Megger rig: leads connect, test runs, curve, PI, verdict stamp | T4 |
| 7 | `POST /sessions`, `GET /sessions/me`, summary card, "My training" list; API tests | Row appears in Prisma Studio; T9, T10 |
| 8 | Hazard zones with entry detection and alarm; breaker animation | T5, T6 |
| 9 | VR mode with the emulator; XR buttons and fallback | VR checklist |
| 10 | AR placement on an Android phone; admin stats | AR checklist |
| 11 | Blender hero model replaces the procedural one; Draco; budget check | Size and triangle numbers recorded |
| 12 | CSP, deploy to Vercel/Render, smoke test on the live URL; Playwright smoke test | T11 |
| 13 | Bug fixing, performance numbers, README, screenshots | Definition of done |
| 14 | Rehearse and record the video; upload; test the link in a private window | Section 14 checklist |

If time is cut, stop after day 8: that is still a complete project (desktop, interlocks, megger, saved runs, hazard zones).

---

## 17. Reference: starter files delivered with this document

`xr-starter/types.ts`, `engine.ts`, `megger.ts`, `clearance.ts`, `__tests__/xr.test.ts` — copy to `frontend/src/xr/`. They have no WebGL dependency, type-check under the repo's `tsconfig`, and the 11 tests pass under Vitest 2 in the repo's frontend setup. They are a starting point to understand and extend; you must be able to explain every line in the video, so read them before using them.
