# Three-mission structured-program pilot

This file and README describe the current build. Earlier four-slot/six-stage briefs are historical. No deployment or publishing is part of this change.

## Operational settings and progression

`js/pilot-config.js` contains three stages, mission order `TASK_1 → TASK_3 → TASK_2`, sensor budgets 7/8/11 and common `TASK_4/5/6` active in every stage. Purpose forms cover only active cleaning missions; common safety/charging appears once as shared requirements. There are 10 actuator positions, no hardware minimum, and no pre-authored learner program.

Default success is all initial dirt; from stage 2, all spills and zero vacuum-on-liquid incidents; from stage 3, all objects correctly sorted. Every stage additionally requires at least one actual moving cat encounter with stopping and no unsafe crossing, a moving human encounter with slowing and a subsequent normal-speed resume with no fast pass, plus LOW observed, DOCK chosen, actual travel and physical connection before depletion. All criteria must hold in one formal run. A stationary robot cannot manufacture moving encounter evidence. There is no time deadline by default.

Fresh formal battery is 35%; LOW remains below 30%, HIGH above 60%. Drain is 0.009 points/tick at 10 Hz, charge 0.25 points/tick, cat dwell 25 ticks. LOW occurs after approximately 56 simulation seconds without charging. Settings are provisional pilot defaults rather than correctness labels or validated thresholds. Formal snapshots export the settings. Researcher-supplied criterion objects support isolated/custom criteria; default stage configuration always contains shared safety and charging.

A recorded passing run unlocks explicit stage advancement. Hardware, complete programs/workspace, literal purpose edits, priorities, observations and prior stage records carry forward. A later failed revision does not erase a recorded passing trial. The latest result and passing-history reference are separately shown. Stage 3 offers closing reflection and the per-stage summary. Sessions are not persisted across browser refresh; download the log before closing.

## Program model and scheduler

`js/sim/program.js` validates and interprets plain serializable trees: Behavior, IF branches/otherwise, AND/OR, action, sequence, repeatUntil/repeatWhile, wait and waitUntil. Condition nodes carry both their canonical condition command and explicit sensor ID. Blockly block IDs become stable AST node IDs. Shared references, cycles, duplicate IDs, misplaced expressions/behavior headers, depth above 32 and more than 512 nodes are rejected. The scheduler performs at most 256 node visits per tick.

Behavior priority is independent of nesting. Higher numeric priority wins; equal priority retains workspace top-block order. Ordered action sequences keep their next statement between ticks. Active IF conditions are reevaluated each tick/resume; changing branches clears stale branch progress. Repeats have explicit completion conditions and never spin synchronously. A wait holds arbitration against lower behaviors but does not secretly stop existing navigation; authors use STOP when stopping is intended. Higher-priority safety can preempt and later resume a lower behavior.

Unavailable/unmodeled channels are UNKNOWN. All operands are read, and UNKNOWN propagates through both AND and OR rather than permitting partial knowledge to trigger a branch. An unknown IF takes neither branch nor ELSE. Missing sensor and actuator details are available in traces; firing records include node identity and read condition/sensor/value provenance. Weight of a held object remains NOT_MODELLED unless that object has actual weight data; no weights were invented.

Blockly edits save visible workspace drafts. Incomplete behaviors do not preserve a hidden older executable tree. Oversized invalid drafts clear executable state and show an explanatory message. Other complete behaviors can still execute. Future mission groups are visibly labeled and remain inactive until unlocked. Hardware can be chosen independently; a missing action actuator blocks that behavior without fabricating execution.

Fresh Run, Reset, and revisions clear interpreter state. Pause/resume and playback speed preserve it. Preview snapshots/restores plain interpreter memory together with world identities, routes, perception maps, goals, counters and formal tick state.

## Physical contracts

Existing primitives and libraries remain. All original IDs/names are retained, including CTRL_01–06. CTRL_05/06 are behavior headers with independent priorities; CTRL_04 contains an arbitrary ordered statement sequence. Legacy flat-rule APIs remain solely as compatible state/executor entrypoints and regression fixtures; the product editor is nested Blockly.

Map has static walkable geometry and only mounted local channel observations. Current-cell UNVISITED is still `COND_05`; forward UNVISITED/VISITED are added as `COND_23/24`; current VISITED is `COND_25`. A forward blocked/nonwalkable cell is unknown for visit comparisons. CLEAN requires a mounted local dirt observation, never mere visited history. Rotation stays a literal turn. Coverage waypoint completion tolerance is 5px (formerly 18px); the tighter radius prevents exploration from marking a nearby waypoint complete while leaving a dirt cell outside local sensor reach after docking/safety detours. Geometry and collision boundaries are unchanged.

Destination commands only select goals. Navigation follows geometry and mounted observations, not hidden task positions or automatic sorting destinations. Physical release evaluates actual object type and destination location. Dock Engage does not select a goal or teleport. Added `ACT_27 DOCK CONNECTOR RELEASE` requires the existing dock-pin actuator, disconnects if connected/charging and clears DOCK, leaving position and battery untouched. This addition is necessary because a 35% start introduces charging before all cleaning can finish; the previous catalog had no way to leave the dock. Release is explicitly authored, never automatic.

## Validation and limits

`tests/structured-feasibility.test.mjs` uses test-only authored trees in the default apartment for all three cumulative stages. It verifies ordinary collision-safe movement, cleaning/mopping/sorting, real moving encounters, physical low-battery docking, charging, release and all criteria in each same formal run. No pass counters or artificial completion flags are injected. The avatar is placed through the existing living-room teleport marker, then remains stationary for a real robot encounter. Examples are not loaded into the learner UI and make no timing or learning-effect promises.

Other unit tests isolate evidence bookkeeping or optional criterion configurations; these do not substitute for the default-room feasibility check. Legacy stage/editor assertions were migrated to three missions and nested authoring while retaining catalog, physics, sensor, logging, preview and POV contracts. Real browser verification covers first Overview, actual mouse snapping/nesting/reordering, persistent language-toggle workspace identity and viewport, live highlighting, final physical feedback and narrow layout.

The editor is desktop-oriented. The 512-node/32-level limit is a responsiveness safeguard, not an educational achievement criterion. Runtime is a cooperative one-command-per-tick controller, with existing automatic locomotion assistance. Existing world models do not model every distractor sensor. Refresh persistence, remote collaboration and deployment are outside this local change.

## Vendored dependency

Blockly 13.4.0 was obtained from the official npm distribution (`https://registry.npmjs.org/blockly/-/blockly-13.4.0.tgz`), package SHA-1 `316ae038eb6694ff4a73d685a2778f3a8b3d985d`.

Vendored files: `vendor/blockly/blockly_compressed.js`, `blocks_compressed.js`, English `en.js`, the package `media/` assets, and Apache-2.0 `LICENSE`. Our editor integration remains in `js/view/structured-blocks.js` and `block-canvas.js`; no runtime CDN is used. Upstream source maps are not needed for operation and are not included.

Official API references consulted: [serialization](https://docs.blockly.com/guides/configure/serialization/) and [block definitions](https://docs.blockly.com/guides/create-custom-blocks/define/block-definitions/). Workspace JSON serialization retains editor structure while the app validates its own executable AST; code generation or eval is not used.
