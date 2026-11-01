# Six-stage pilot implementation and researcher guide

This document and README describe the current single-learner workflow. Older v6/build briefs are historical references: minimum hardware counts, weight sliders, collaboration, omniscient Map, automatic sorting destinations and the earlier two-stage pilot no longer describe this build.

## Progression and hardware budgets

`js/pilot-config.js` defines six cumulative stages. Each adds one task and retains every earlier functional criterion:

1. Vacuum all initial dirt; up to **3 sensors**.
2. Also pick up and correctly sort all four objects; **6 sensors**.
3. Also mop all spills, with zero vacuum-on-liquid events; **7 sensors**.
4. Also stop in every moving cat encounter, at least one, with zero unsafe crossings; **8 sensors**.
5. Also slow in every moving participant encounter, at least one, resume normal speed at least once, with zero fast passes; **9 sensors**.
6. Also observe low battery, explicitly select DOCK, physically travel and engage the connector before depletion; **10 sensors**.

The chassis retains 11 physical sensor positions and 10 actuator positions. The mounting editor shows the stage's active sensor positions and budget. All 15 sensor and 14 actuator library items remain available. Empty installations are permitted. State and UI reject overfill; removal and replacement remain available at capacity. Budgets constrain quantity, not a prescribed sensor set.

A recorded passing **formal** run and an explicit Continue unlock the next stage. The next stage starts at Purpose, asking the learner to choose priorities for its current tasks. Mounted hardware, stable rule IDs, rules, observations, prior purpose choices, reflections and run records carry forward. A retained passing run remains the basis for progression after a later failed revision; the latest result remains separately identified. Stage 6 has the closing reflection and per-stage summary. Failed sessions can also be closed and exported.

## Researcher settings

`STAGE_CRITERIA` specifies fractions and observable safety requirements. Defaults use dirt/sorting/spill fractions of 1, at least one moving cat/person encounter, a response in every encounter, zero unsafe crossings/fast passes/liquid misuse, at least one human speed resume, and a 30% low-battery threshold. These are pilot operational settings, not validated research thresholds. Zero encounters and a stationary robot never satisfy safety tasks. The Battery channel, LOW condition and docking encounter use the same configured `lowBatteryPercent` (default 30); catalog descriptions identify the value as a default rather than a fixed sensor cutoff.

`speedLimitSeconds: null` for every stage means elapsed duration is observed without a deadline. Choosing Speed as a purpose priority does not invent a target. A finite researcher target adds an independent Speed criterion based on simulation time to complete every current function. The Timer limit condition uses the same configured target and remains false with no target. Task badges and exported completed tasks use the functional criteria independently of Speed. Private legacy score helpers do not determine passage or appear in learner feedback/new snapshots.

`SIMULATION_SETTINGS` is a shared simulation-only calibration surface. All stages start at 100% battery and use **0.009 percentage points per 10 Hz tick** (0.09 per simulation second), 0.25 charge per charging tick, and deterministic 25-tick cat dwells. Full nominal endurance is approximately 1,111 simulation seconds; LOW occurs around 777.8 seconds. This has no mapping to a real battery. The old arbitrary drain, 0.05 per tick, exhausted in 200.1 seconds after cleaning only 10/17 cells with local-sensing coverage. No run-specific battery rescue, refill, teleported robot, automatic return or automatic connection is used.

The ordinary authored examples finish stages 1–5 in approximately 503.9–728.0 simulation seconds with at least 34% battery. Stage 6 finishes at about 823.5 seconds, physically connecting at 25.9%. Its prior functions finish around 728 seconds, followed by roughly 50 seconds of further exploration before LOW and 46 seconds of travel/connection. At 5x playback that interval is about 19 seconds. Timings describe the included deterministic example, not a guarantee for arbitrary designs; calibrate task difficulty and duration with participants.

## What the robot can know and how it moves

Map reports **static layout, visited coverage and locally observed state**. It never enumerates unseen world dirt or wet coordinates. A mounted Dirt sensor observes dirt only within its local underfoot radius; Wet likewise observes nearby liquid. Map remembers these observations only while mounted. Removing Dirt or Wet withholds its mapped channel and prevents new detections; removing Map withholds coverage and both mapped channels. Unknown is never represented as CLEAN. Persistent visited coverage is independent of the short visual path trail. Coverage sensing is read-only: repeated POV/sensor reads preserve the current first-visit observation. A tick commits the entered physical cell and nearby coverage after rule evaluation and before any action movement or navigation, so UNVISITED can fire on first entry and clears on revisit, including cells whose rounded center is unsuitable as a planning waypoint. Entry history is separate from the neighboring coverage footprint used for navigation.

Coverage exploration selects unvisited static walkable geometry points, spaced 24 pixels apart, without querying dirt, spills, objects, cat or participant positions. Discovered unfinished goals can be routed to. Vision reports the nearest object within its 180-pixel, 120-degree forward cone and can retain only previously reported object positions while mounted. The robot's own held object sits 25 pixels ahead in the camera cone and can be classified by Vision. Unmounted Grip reports no holding information; internal held-object state remains available solely for carrying/physical navigation. Removing Vision withholds remembered object targets.

The navigation controller supplies geometry planning through normal doors, aiming and a visible collision stop/turn reflex. Static planning uses the existing collision model with 1-pixel planning clearance and genuine collision-free line segments. It never completes cleaning, pickup, release or connection. Both Wheel Drive and Body Rotation are physically required to move. Distance is useful local obstacle feedback, but optional when the static map/controller already supports navigation. It is not artificially required for safe collision geometry.

A continuous-vacuum design may clean without Dirt sensing: this is a legitimate blanket-cleaning choice. Information choices affect available observations, conditional rules and tool use; they do not imply a unique correct hardware set. Inspection duration and clean-floor vacuum duration are reported without invented pass thresholds.

## Learner-selected destinations and rule execution

New Actions **ACT_24 SELECT DESTINATION BIN**, **ACT_25 SELECT DESTINATION TABLE**, and **ACT_26 SELECT DESTINATION DOCK** select a navigation goal without new actuator hardware. Destination sensing reports only that chosen goal's direction, distance and reached state. Holding TRASH or CUP never chooses a destination automatically. A chosen sorting goal is traveled to while physically carrying; before pickup, mounted perception still supports approaching the object. The learner must author classification, destination choice, pickup and release. Physical grading checks the actual type and actual release location. Wrong releases remain visible and counted. Releasing clears the current goal.

DOCK CONNECTOR ENGAGE never selects DOCK. It connects only when physically within 30 pixels of the dock with battery remaining. Stage 6 additionally requires observed LOW, a subsequent DOCK choice and real travel before connection. A connector-only or high-battery docking attempt cannot satisfy that criterion. There is no automatic low-battery behavior.

All original IDs, names and catalog items remain. Descriptions of Map, Destination and Vision now match their information boundaries. Conditions **COND_21 IF floor is DRY** and **COND_22 IF animal is CLEAR** supplement the original 20. The original 23 Actions plus three choices produce 26; all 15 Sense and six Control items remain.

Each unlocked task has an empty stable-ID rule row and can add more. Only block kinds constrain editing; unavailable hardware and incompatible semantic choices are observed at runtime. HIGH precedes NORMAL, ties retain row order, and an eligible queued THEN precedes a primary at equal priority. HIGH can preempt it. A setting already satisfied yields its arbitration slot; for a THEN pair, both actions must already be satisfied before the primary yields. STOP continues to fire each tick while its condition holds. This prevents repeated goal/speed/tool settings from starving pickup and other actions while preserving deliberate priority conflicts. No default answer is installed.

## Lifecycle, feedback and records

Fresh formal runs reset the world, clock, tools, routes, coverage, perceived maps/objects, goal choices, encounter evidence, battery evidence, WAIT clocks and THEN queues. Pause/resume and playback speed preserve runtime. Reset retains the design and previous formal records. Edits invalidate stale control queues. Preview restores world entity identities and every engine counter/map/setting; it cannot create a formal pass, history entry, stage unlock or failure reflection.

Feedback uses Achieved / Partially achieved / Not achieved with dirt/sorting/spill counts, liquid misuse, actual cat encounters/stops/crossings, person encounters/slowing/resumes, and docking battery/travel. Moving encounters are evaluated at the pre-action detectable proximity, avoiding an impossible required response to a range crossed only after movement. A parked robot cannot create a new encounter based on movement long ago. Person speed values, inspection seconds and clean-floor vacuum seconds are retained as observations. Completed-task snapshots agree with current functional criteria. Failed formal endings can show one reflection with four edit targets; unfinished ticks and previews do not.

CSV remains `timestamp,step,event,target_id,detail`. Records retain stage/task context, ordering, stable rule identity, purpose/task priorities, execution priorities, stage budgets, configuration, researcher settings, chosen goal history, perceived map/coverage, actual event counters, elapsed seconds and pass status. There are no score/weight fields in new run snapshots. Refresh does not persist a session; download the log before closing.

The light English UI, fixed FPS spawn, Workstation control, scroll retention, separate rule priorities, mounted-only POV, POV exit restoration, collision walls and normal doors remain. No normal 2D view button or extra scenes, maps, persistence, network service or dependency is added.

## Verification

Run `node --test tests/*.test.mjs`. Six-stage tests include actual ordinary-world authored solutions for every cumulative stage with normal battery, collision checks and physical outcomes. The participant is placed using an existing living-room teleport marker for stages 5–6; the robot must actually encounter, slow and leave them. Local unit encounters separately exercise unavailable sensing and stationary failures. Catalog retention uses a portable original-ID/name fixture, not temporary Git commits or obsolete whole-file hashes.

`tests/fixtures/authored-solution.mjs` exports `authorSolution(stage)` solely for tests/reviewer browser verification. It installs an example in an already selected stage and is never imported by the app. It contains no world/battery manipulation. Browser checks should separately inspect actual mounting/overfill/replacement, scroll, GUI rule creation, progression, later-stage layout, POV restoration and CSV export. A seeded UI layout is not proof of physical task completion.
