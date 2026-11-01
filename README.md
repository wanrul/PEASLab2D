# PEASLab2D

Independent single-learner adaptation of CollabPEAS commit `1389b5cc260e03c8f235dfc001a21ba7c52b55ae`. The original application remains untouched in `../CollabPEAS/collabpeas-2d`.

## Open

```bash
node server.js 8089
```

Open http://localhost:8089 and keep the server running. Local files and Node.js suffice; no package installation or internet is needed. Sessions are in memory and start fresh on refresh.

## Learning flow

The current frontend follows the supplied v6 build brief, transcribed in `docs/BUILD_BRIEF_V6.txt`.

1. Set four weights in 10% increments totaling 100 for the fixed six-task mission; a red inline notice appears above 100%.
2. Inspect the apartment, mount 8–11 of 15 sensors, and try sensor-bounded robot POV.
3. Mount 7–10 of 14 actuators on the assembly preview.
4. Build rules in six fixed task zones, each initially holding one empty typed row. Add or remove rows within a task; the sole remaining row cannot be removed. One SENSE + ACTION pair allows continuing. Semantic mismatches are accepted and the robot demonstrates the result.
5. Watch six live task icons and four scores; run, stamp observations with optional notes, revise sensors/body/rules, answer a once-per-run reflection, then finish with closing text and a first/final run summary.

Mounting catalogs scroll independently of the fixed assembly panel. The rule library has SENSE/CONDITION/ACTION/CONTROL tabs, remembers each category’s scroll position and retains both column offsets after placing or removing blocks.

Hardware and rules start empty. Cards have randomized order and no recommendation/distractor/limitation labels. Steps unlock through numeric gates and remain revisitable. Rule previews restore the original simulation state before formal testing. Finish prevents further runs in that session.

Five hotspots and scattered objects appear in 2D, orbit and FPS. Robot POV shows only mounted sensor channels; without the vision module the apartment image is absent. Exit returns to the prior page and camera. FPS/POV retain the wider field of view and compact labels.

## Research logs and measures

Download log produces one CSV with `timestamp,step,event,target_id,detail`; detail includes event order and relevant configuration/behavior data. There is no PlayerID column. RULE_ADDED and RULE_REMOVED target the stable rule ID and include the task ID and rule slots; BLOCK_PLACED/BLOCK_REMOVED retain the block target and include task, rule and slot identities. RULE_FIRED targets the stable rule ID and includes its task identity. RUN_ENDED records four scores, weighted total, all six observed task outcomes, world/event counters, elapsed simulation time, completion results and weights. Sessions are local, without participant recruitment IDs or persistent storage.

Scores expose their definitions on hover: Coverage is 70% dirt cleaned + 30% correctly sorted objects; Safety is 100 minus 8 per moving cat near-miss and 5 per fast person pass; Hazard is the percentage of spills mopped minus 25 per vacuum-on-spill encounter. Continuous encounters count once until the robot leaves. Time uses 10 Hz simulation time, excluding pauses and independent of playback speed. It stays at 100 through the run limit and falls linearly by 100 × overtime / limit afterward; completion of every attempted task freezes its completion time, unless a later failure invalidates that completion. Runs continue after the limit. Coefficients are centralized in `SCORE_CONSTANTS`. The default 120-second run limit is a provisional, uncalibrated pilot setting; a researcher can pass `new SimulationEngine(world, { runLimitSeconds: 120 })`. There is no learner-facing limit setting. These measures need pilot calibration before a formal study. Light/lux and held-object mass are not modeled; those mounted channels display a dash rather than fabricated readings. The body assembly uses procedural geometry and one-second module animations.

## Execution and observed outcomes

All six tasks run together. The body explores only with Wheel Drive and Body Rotation. Navigation chooses an already perceived target (mapped dirt or wet cells, the nearest visible object, or a reported destination), routes through the existing apartment doorways, and uses a visibly named built-in collision reflex. It does not consult a selected task. An engaged dock connector requests return; only mounted Destination sensing guides that return, and connecting still requires physical arrival. No teleportation or implicit sorting is used.

Each action requires its catalog actuator. Missing sensors and actuators produce observable trace lines. WAIT delays 20 ticks before continuing; WHILE and UNTIL repeat while their condition holds. HIGH wins arbitration. THEN exposes a typed secondary Action slot and attempts it on the next available tick before another normal-priority primary, including when the primary lacks an actuator. One winning rule action executes per tick.

Carried objects ride the robot, misplaced releases remain on the floor, correct deposits count as sorted, and the bin lid opens visibly. LED actions share the catalog colors in 2D and 3D. Completed run summaries include the six observed one-line outcomes and retain them in the final summary and CSV. Safety completion requires actual movement, an encounter, the appropriate stop/slow response and no violation; an untouched environment cannot earn those task completions.

The supplied outcome table omits never-approached docking and safety cases with no opportunity or no observed response. Those cases use neutral observations (for example, “Never approached the dock.”), without naming a fix. Each fixed task zone supports multiple independently authored rules, so a task can use multiple chains without borrowing another task’s zone. Added rows are empty and there is no rule-count cap. Attempted-task counts and Time completion track distinct task IDs (0–6), regardless of row count. Every row has a stable ID used by execution, highlighting and logs. Rule edits, additions and removals restart WAIT timing and clear pending THEN actions; pause/resume preserves those controls when configuration is unchanged.

## Geometry and checks

The 2D background is a true overhead render of the same GLB and coordinate projection as collision and markers. A matching vector plan is shown while loading or without WebGL. Architectural walls, exposed floor boundaries and principal furniture footprints come from the GLB. Movement substeps prevent tunneling; safe spawn, reset and teleport destinations are checked.

After replacing the model, regenerate collision data:

```bash
node scripts/extract-apartment-collision.mjs
node --test tests/*.test.mjs
```

Other copied upstream documents are historical references; they do not describe this v6 interface.
