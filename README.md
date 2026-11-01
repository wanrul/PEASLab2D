# PEASLab — staged single-learner pilot

A desktop robot-design prototype using the existing apartment, collision model and complete task, sensor, actuator and block catalogs. No package installation or internet is required.

## Open

```bash
node server.js 8089
```

Open http://localhost:8089 and keep the server running. Sessions are in memory; refreshing starts a new session. Download the session log before closing.

## Current workflow

Start in FPS at the fixed living-room position (130, 645; heading −0.662), with Workstation closed. Keep FPS, 3D overhead/orbit and Robot POV; exiting POV restores the previous page and camera. The internal overhead canvas is used for rule previews and as a WebGL failure fallback. It is not a normal learner view option.

1. **Vacuum the floor** — up to 3 sensors.
2. **Add object pickup and sorting** — 6 sensors.
3. **Add spill cleaning without vacuuming liquid** — 7 sensors.
4. **Add stopping for the moving cat** — 8 sensors.
5. **Add slowing near the participant and resuming afterward** — 9 sensors.
6. **Add explicit low-battery return and physical docking** — 10 sensors.

Every stage retains earlier tasks. A recorded passing formal run and **Continue to next stage** unlock the next stage at Purpose. Hardware, stable rule IDs, rules, observations and earlier results carry forward.
Each stage follows Purpose → Sensors → Actuators → Logic → Test & Debug. Steps unlock progressively and remain revisitable within the stage. Purpose requires an explicit priority for every current task: Thorough cleaning / Speed for cleaning; Correct sorting / Speed for sorting. Priorities record intent; they do not silently alter motion or execution.

The complete 15-sensor and 14-actuator libraries stay available at every stage. Hardware starts empty. The chassis has 11 physical sensor positions; stage sensor budgets above apply, alongside 10 actuator positions, with **no minimum**. Cards carry no recommendation or correctness labels. Installed sensors have labeled attachments on the body; actuator assembly remains procedural. Library scrolling is independent of the fixed assembly panel.

The Logic editor shows only unlocked task groups. Each has at least one empty typed rule row; additional rows have no imposed limit. Sense (15), Condition (22), Action (26) and Flow Control (CTRL_01–04) retain the full original entries, with two negative conditions and three explicit destination choices added. **High/Normal execution priority** uses CTRL_05/06 in a separate row selector, so it can coexist with THEN, WAIT or repeat. THEN exposes a typed second action. Editing retains shelf and rule-column scroll positions. Missing hardware and semantic mismatches are observed during execution rather than rejected or corrected.

## Researcher criteria

Edit `js/pilot-config.js` before a pilot. The defaults are **uncalibrated pilot operational settings, not validated thresholds**:

- All stages: clean every initial dirt cell. Stage 2 onward: also correctly sort every object. Stage 3 onward: mop every spill with zero vacuum-on-liquid events.
- Stage 4 onward: stop in every moving cat encounter (at least one), with zero unsafe crossings. Stage 5 onward: slow in every moving person encounter (at least one), resume at least once, and make zero fast passes.
- Stage 6: observe battery below 30%, explicitly select DOCK, travel and physically connect before depletion.
- Every stage: `speedLimitSeconds: null`. Duration is observed without a deadline. A selected Speed priority does not invent a target.
- Shared simulation endurance: `batteryDrainPerTick: 0.009` at 10 Hz; full battery lasts approximately 1,111 simulation seconds and LOW occurs around 778 seconds. This replaces arbitrary 200-second endurance that was infeasible with local exploration. It is a common simulation-only researcher setting, without refills or a real-world battery interpretation. Cat dwell is deterministic (25 ticks) for comparable resets.
If a researcher supplies a finite numeric speed target, the criterion checks actual simulation time to complete the required functions. It reports incomplete work as unmet even before that target. The Timer block's limit condition uses that same explicit target; with no target it cannot fire on an invented timeout. There is no learner-facing researcher setup screen.

## Testing and feedback

Run starts a fresh formal run from the same reset environment and fresh counters, clock and control queues. Pause/resume and playback Speed preserve the current run. Reset clears the world and runtime, retaining the assembled design, observations, stage history and recorded passing runs. Rule/hardware/purpose edits invalidate stale WAIT/THEN runtime. Preview restores world entity identities and counters and cannot record a formal run or unlock a stage.

Only unlocked task rules can fire. **Map supplies static layout/coverage and remembers only observations from mounted Dirt/Wet sensors.** It cannot locate unseen dirt or spills. Exploration uses unvisited walkable geometry; mounted Vision retains only objects it actually observed in its bounded camera cone, including its visibly held object. Removing a sensor withholds its channels and navigation memory. Unknown is never CLEAN.

The learner authors **SELECT DESTINATION BIN / TABLE / DOCK**. Destination sensing reports that chosen goal, never a type-derived answer. Correct physical release sorts; wrong releases remain visible. Connector Engage never chooses the dock. Navigation assists aiming and doorway routing, while rules perform cleaning, pickup, choice, release and connection. Wheels plus Rotation are required to move; existing collision geometry remains safe without Distance sensing. A satisfied setting yields its arbitration slot; a THEN pair yields only when both actions are satisfied. HIGH still preempts NORMAL and queued THEN wins ties over primary actions.

Continuous vacuuming can be a valid blanket-cleaning design without Dirt sensing. Inspection and clean-floor vacuum duration are observations, with no invented pass threshold.
Test & Debug and the HUD show factual criterion evidence with **Achieved / Partially achieved / Not achieved**, counts and elapsed simulation seconds. There are no numeric grades or weighted totals. Use **End run & evaluate** to record an outcome. A failed formal ending can show one short reflection about goal, sensors, rules or actuators; unfinished progress and previews do not trigger one. Direct edit buttons return to all four design steps. Each intermediate stage uses its retained recorded passing run, explicitly labeled as such; a later failed revision is separately recorded and never presented as current success. Finish in Stage 6 opens a closing reflection and a per-stage summary.

## Research records

**Download log** exports one CSV: `timestamp,step,event,target_id,detail`. Detail includes stage IDs, current task IDs and event order. Purpose changes and task priorities are separate from rule execution priorities. Rule changes and firings retain stable task/rule identity. Run-start/end records contain the configuration, researcher criteria and simulation settings, stage budgets, chosen goals, observed maps, factual outcomes, counts, elapsed seconds and pass result. New snapshots contain no scores or weights. Stage start/end/transition, observations and reflections retain their stage context. No Player A/B, participant-ID column or network synchronization is used.

Private legacy scoring helpers remain only for regression coverage; they do not determine passage, learner feedback or new run exports. Older build briefs and upstream design documents are historical references superseded by the staged pilot workflow. See `docs/STAGED_PILOT.md` for implementation and research details.

## Verification

```bash
node --test tests/*.test.mjs
```

Default-apartment authored regressions complete all six cumulative stages with ordinary battery and actual movement/cleaning/sorting/encounters/docking. The regression suite covers stage passage, preview isolation, configuration carryover, fresh-run resets, rule controls, criteria, logs, mounted hardware, routing/collision and POV restoration. Portable checks retain every original catalog ID/name/item while allowing documented description changes and additions. See `docs/STAGED_PILOT.md` for thresholds, measured durations, controller support and limits. Collision geometry remains derived from the existing GLB; regenerate only when replacing the model:

```bash
node scripts/extract-apartment-collision.mjs
```

## Interface language

Use the bottom-left **中文 / English** buttons at any time, including during a run or Robot POV. English is the initial fallback; the browser remembers the last choice when local storage is available. Switching changes presentation only: it preserves the assembled robot, rules, drafts, selections, simulation and research records. Core PEAS terms, hardware/block names and execution tokens remain English. Participant notes and edited purposes/reflections stay literal; untouched factory purposes can display in Chinese while the model and CSV retain English.

Translations live in `js/i18n-zh.js`; anchored live-feedback templates and reversible DOM updates live in `js/i18n.js`. Add translations when changing authored UI copy, keep user-generated text inside `data-i18n-skip`, and bind factory purpose inputs with their stable stage/task key. Never translate catalogs or simulation state, rebuild an editor on a language switch, or translate raw perception data. Existing 2D draw calls and 3D canvas textures read the current presentation language.

The normal Node suite includes dictionary/catalog coverage and presentation regressions. The optional real-browser regression is `tests/localization.browser.mjs`: start the local server, set `PLAYWRIGHT_MODULE` to an installed Playwright module, optionally set `TEST_URL` and `CHROME_PATH`, then run it with Node. No browser package is added to this project. Its temporary graphics downscale affects that test page only.
