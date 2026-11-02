# PEASLab — three cumulative household missions

A local, single-learner robot-design prototype using the existing apartment, collision model, and complete original task, sensor, actuator and block libraries. No package installation or runtime internet connection is required.

## Open locally

```bash
node server.js 8089
```

Open http://localhost:8089 and keep the server running. Sessions are held in memory; refresh starts a new session. Download the session log before closing.

## Workflow

Overview opens first and explains the challenge before Purpose. Begin enters the five steps: **Purpose → Sensors → Actuators → Logic → Test & debug**. Overview can be revisited without discarding work. Closing Workstation returns to the existing fixed living-room FPS view. FPS, Orbit and Robot POV retain their existing camera and return behavior.

| Stage | Cumulative mission | Sensor budget |
| --- | --- | --- |
| 1 | Vacuum the floor (`TASK_1`) | 7 |
| 2 | Add spill cleaning (`TASK_3`) | 8 |
| 3 | Add pickup and sorting (`TASK_2`) | 11 |

**Common safety and charging apply from stage 1:** navigate furniture and doorways, stop during moving cat encounters (`TASK_4`), slow near people and resume after leaving (`TASK_5`), and select, reach and physically connect to the dock when battery is low (`TASK_6`). These remain stable internal behavior IDs, grouped as common requirements rather than extra numbered missions or Purpose forms.

A recorded passing formal run and explicit Continue unlock the next stage. The current hardware, authored programs, edited purposes/priorities, observations and results carry forward. Earlier missions must still succeed. Final success requires all functional and shared criteria in the same formal run. Purpose priorities record learner intent; execution priorities are authored independently in Logic.

The full 15-sensor and 14-actuator libraries remain available without recommendation or correctness labels. Initial hardware and programs are empty. There is no minimum selection; there are 10 actuator positions. The 7/8/11 budgets are provisional pilot settings, not validated thresholds.

## Nested programs

Logic uses locally vendored **Blockly 13.4.0** with genuine drag, snap, nesting, stack reordering, zoom, pan and execution highlighting. Start with a Behavior header, choose its mission/common group and execution priority, and connect statements. Future-mission groups are labeled and do not execute until active. All original Sense, Condition, Action and Control IDs/names remain available.

- Connect each Condition to its compatible Sense block. Combine conditions with AND / OR.
- Use the IF gear to add ELSE IF and ELSE. Branches contain ordered action sequences or nested controls.
- REPEAT UNTIL and REPEAT WHILE take explicit conditions; WAIT UNTIL suspends program advancement until its condition is met. WAIT 2 seconds retains the original command; THEN holds a sequence.
- Higher numeric execution priorities run first, independently of nesting. A waiting behavior retains arbitration priority while ongoing physical navigation continues. Use an explicit STOP for stopping motion. A higher-priority safety behavior may interrupt a lower sequence; active branch conditions are reevaluated on resume.
- Every compound input must be available. Missing/unmodeled inputs propagate UNKNOWN through both AND and OR. UNKNOWN is never CLEAN or known false, and never chooses ELSE. Traces identify missing input provenance.
- Disconnected and incomplete blocks remain visible drafts but do not execute an older hidden program. Programs are limited to 512 AST nodes and 32 nesting levels; runtime work is bounded to 256 node visits per tick.

The canonical serialized behavior tree, stable node IDs and the editable Blockly workspace are saved in application state and formal run configuration. The existing SimulationEngine remains the single physical executor. Legacy flat-rule APIs remain for retained primitive regression coverage, but the learner editor authors trees.

## Battery and physical behavior

Every fresh formal Run starts at **35%**, with LOW below **30%**. Normal drain is 0.009 percentage points per 10 Hz tick: LOW is encountered after about 56 simulation seconds, rather than waiting around 13 minutes. Physical docking charges at 0.25 points per tick. These are operational pilot settings, not real-world battery estimates. The settings are exported with every run.

`SELECT DESTINATION BIN / TABLE / DOCK` chooses a goal. Destination sensing reports the learner's choice, never an automatic classification answer. Wheels and Rotation are required for movement. Existing navigation assistance follows observed goals and static geometry; local sensors never reveal unseen dirt, liquid or objects.

`DOCK CONNECTOR ENGAGE` requires actual proximity and the connector actuator. The additive `ACT_27 DOCK CONNECTOR RELEASE` uses that same actuator, disconnects and clears a selected DOCK goal without teleporting or changing battery. The learner must author release to resume work. Battery HIGH retains its existing meaning: above 60%.

Map's existing current-cell UNVISITED remains unchanged. New `COND_23/24` report forward-cell UNVISITED/VISITED using installed Map, actual heading, walkable geometry and prior visits. `COND_25` reports current-cell VISITED. VISITED does not mean CLEAN. Rotation remains a literal turn, never a hidden search operation. Coverage waypoints count as reached within 5 pixels so local sensing does not leave gaps after repeated docking detours.

## Testing, feedback and records

Run resets world/runtime and starts a formal trial. Pause and playback speed preserve progress. Reset and edits clear stale sequence/wait state; Preview restores world identities, control state, maps and counters and cannot unlock a stage. Formal feedback uses factual counts, duration, and **Achieved / Partially achieved / Not achieved**, with no grades or learning-gain claims.

Download log exports `timestamp,step,event,target_id,detail`. Details include stage/task context, event order, stable program/node identity, sensor provenance, configuration, researcher criteria, simulation settings, actual goal history, sensed memory, observations and run outcomes. Prior passing runs remain separately identified if a later revision fails.

Use **中文 / English** at any time. Translation preserves hardware, programs, workspace identity/pan/zoom, user drafts and running simulation. Core terms, catalog names, commands and IDs stay English; learner text stays literal. Untouched factory purposes can display Chinese while canonical state stays English.

```bash
node --test tests/*.test.mjs
```

The suite includes three actual default-apartment structured solutions, normal movement/cleaning/mopping/sorting, shared safety encounters, docking, charging and explicit release. Test-only solutions are never installed into the learner workspace. Real-browser checks are `tests/structured.browser.mjs` and `tests/localization.browser.mjs`; set `TEST_URL`, `PLAYWRIGHT_MODULE`, `CHROME_PATH` and optional `ARTIFACT_DIR` for the local environment. No browser package is required by the application.

See [pilot details](docs/STAGED_PILOT.md) for limitations and dependency provenance. Existing geometry can be regenerated only when intentionally replacing the model, using `node scripts/extract-apartment-collision.mjs`.
