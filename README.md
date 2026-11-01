# PEASLab — staged single-learner pilot

A desktop robot-design prototype using the existing apartment, collision model and complete task, sensor, actuator and block catalogs. No package installation or internet is required.

## Open

```bash
node server.js 8089
```

Open http://localhost:8089 and keep the server running. Sessions are in memory; refreshing starts a new session. Download the session log before closing.

## Current workflow

Start in FPS at the fixed living-room position (130, 645; heading −0.662), with Workstation closed. Keep FPS, 3D overhead/orbit and Robot POV; exiting POV restores the previous page and camera. The internal overhead canvas is used for rule previews and as a WebGL failure fallback. It is not a normal learner view option.

1. **Stage 1: vacuum the floor.** Choose a task priority and define its purpose, assemble a robot, author rules, and test cleaning.
2. **Stage 2: add object pickup and sorting.** After a recorded passing Stage 1 run, explicitly select **Continue to next stage**. Sensors, actuators, stable rule IDs, observations and Stage 1 results carry forward. Revisit the five steps for the cumulative task set. Test sorting and the original cleaning capability together.

Each stage follows Purpose → Sensors → Actuators → Logic → Test & Debug. Steps unlock progressively and remain revisitable within the stage. Purpose requires an explicit priority for every current task: Thorough cleaning / Speed for cleaning; Correct sorting / Speed for sorting. Priorities record intent; they do not silently alter motion or execution.

The complete 15-sensor and 14-actuator libraries stay available at every stage. Hardware starts empty. Only physical capacities apply: up to 11 sensors and 10 actuators, with **no minimum**. Cards carry no recommendation or correctness labels. Installed sensors have labeled attachments on the body; actuator assembly remains procedural. Library scrolling is independent of the fixed assembly panel.

The Logic editor shows only unlocked task groups. Each has at least one empty typed rule row; additional rows have no imposed limit. Sense (15), Condition (20), Action (23) and Flow Control (CTRL_01–04) retain the full original entries. **High/Normal execution priority** uses CTRL_05/06 in a separate row selector, so it can coexist with THEN, WAIT or repeat. THEN exposes a typed second action. Editing retains shelf and rule-column scroll positions. Missing hardware and semantic mismatches are observed during execution rather than rejected or corrected.

## Researcher criteria

Edit `js/pilot-config.js` before a pilot. The defaults are **uncalibrated pilot operational settings, not validated thresholds**:

- Stage 1: all initial dirt cells cleaned (`dirtFraction: 1`).
- Stage 2: all initial dirt cells cleaned and all initial objects correctly sorted (`dirtFraction: 1`, `sortedFraction: 1`).
- Both stages: `speedLimitSeconds: null`. Duration is an observation and does not affect passage. A selected Speed priority does not invent a time target.

If a researcher supplies a finite numeric speed target, the criterion checks actual simulation time to complete the required functions. It reports incomplete work as unmet even before that target. The Timer block's limit condition uses that same explicit target; with no target it cannot fire on an invented timeout. There is no learner-facing researcher setup screen.

## Testing and feedback

Run starts a fresh formal run from the same reset environment and fresh counters, clock and control queues. Pause/resume and playback Speed preserve the current run. Reset clears the world and runtime, retaining the assembled design, observations, stage history and recorded passing runs. Rule/hardware/purpose edits invalidate stale WAIT/THEN runtime. Preview restores world entity identities and counters and cannot record a formal run or unlock a stage.

Only unlocked task rules can fire or provide navigation goals. Routing uses mounted perception and normal door openings; it never cleans or sorts automatically. With Vision mounted, previously seen object positions can remain navigation candidates until pickup, so a detected object is not forgotten while another goal is handled. Memory resets for each fresh run and cannot reveal an unseen object. Wheel Drive and Body Rotation are both needed to move. Every action requires its catalog actuator. Carrying, misplaced releases, correct deposits, bin lids and catalog LED colors remain visible.

Test & Debug and the HUD show factual criterion evidence with **Achieved / Partially achieved / Not achieved**, counts and elapsed simulation seconds. There are no numeric grades or weighted totals. Use **End run & evaluate** to record an outcome. A failed formal ending can show one short reflection about goal, sensors, rules or actuators; unfinished progress and previews do not trigger one. Direct edit buttons return to all four design steps. Stage 1 progression uses its retained recorded passing run, explicitly labeled as such; a later failed revision is separately recorded and never presented as current success. Finish in Stage 2 opens a closing reflection and a per-stage summary.

## Research records

**Download log** exports one CSV: `timestamp,step,event,target_id,detail`. Detail includes stage IDs, current task IDs and event order. Purpose changes and task priorities are separate from rule execution priorities. Rule changes and firings retain stable task/rule identity. Run-start/end records contain the configuration, researcher criteria, factual outcomes, counts, elapsed seconds and pass result. New snapshots contain no scores or weights. Stage start/end/transition, observations and reflections retain their stage context. No Player A/B, participant-ID column or network synchronization is used.

Private legacy scoring helpers remain only for regression coverage; they do not determine passage, learner feedback or new run exports. Older build briefs and upstream design documents are historical references superseded by the staged pilot workflow. See `docs/STAGED_PILOT.md` for implementation and research details.

## Verification

```bash
node --test tests/*.test.mjs
```

A default-apartment rule-driven regression completes Stage 1 and cumulative Stage 2 using ordinary battery, without manipulating objects, walls or power. The regression suite covers stage passage, preview isolation, configuration carryover, fresh-run resets, rule controls, criteria, logs, mounted hardware, routing/collision and POV restoration. Catalog fingerprints verify byte preservation independently of Git history. Collision geometry remains derived from the existing GLB; regenerate only when replacing the model:

```bash
node scripts/extract-apartment-collision.mjs
```
