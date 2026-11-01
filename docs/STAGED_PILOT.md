# Staged pilot implementation and researcher guide

This document and README describe the current single-learner workflow. Historical v6/upstream documents retain catalog and development context; their six-task mission, weight sliders, minimum hardware counts, compatibility gates and collaboration assumptions do not describe this pilot.

## Authority and progression

`js/pilot-config.js` defines two stages, their task identities, purposes/priorities and observable criterion descriptions. The six-task catalog remains intact in `js/data/tasks.js`. Stage 1 uses TASK_1. Stage 2 uses TASK_1 plus TASK_2. Other catalog tasks do not participate in editing groups, attempted-task counts, arbitration, routing, outcomes or passage.

`StateManager` keeps current-stage navigation, independent `stagePurposes`, retained `stageResults` and chronological `runHistory`. Stage 2 is entered only through `continueStage()` after a recorded Stage 1 passing formal run. Merely entering Step 5, performing a preview or cleaning a preview world does not create a pass. A prior recorded pass remains the explicit basis for progression after a later failed revision; the latest run's evidence and results remain separate. Transition starts Stage 2 at Purpose/Step 1 without deleting installed hardware, rules, observations or Stage 1 choices and reflection.

Purpose's editable text is initialized per task and stage; the learner must actually choose a task priority. Stage 2 asks for priorities again. A purpose priority expresses intent and is independent of High/Normal rule arbitration. It does not secretly change behavior or prescribe a correct solution.

## Operational settings requiring calibration

`STAGE_CRITERIA` in `js/pilot-config.js` is the small researcher configuration surface. Defaults require all initial dirt in Stage 1, and all initial dirt plus correctly sorted objects in Stage 2. Fractions are operational acceptance settings, not empirically validated thresholds. Researchers should calibrate them and the task count/difficulty through pilot testing before a formal study.

`speedLimitSeconds: null` is the default for both stages. Duration is observed using 10 Hz simulation ticks, independent of playback speed or pauses. Speed is not graded or claimed achieved when no target exists. An explicit finite numeric time target adds a criterion; success requires the required functions to complete within the target. The criterion reports the completion duration, or elapsed duration with tasks incomplete. The Timer limit condition also refers to this explicit setting and stays false when no target is configured. No 120-second grading or pass deadline is used. The old score helper's provisional constant remains a private compatibility detail for existing regression tests.

## Execution lifecycle

Every fresh formal run calls the existing world reset and clears runtime counters, active tools, task evidence, navigation routes, WAIT clocks, THEN queues and elapsed time. Sensors, actuators and authored rules are retained. Run-start snapshots freeze the installed configuration and settings. Pause/resume and Speed changes continue the same formal run and preserve control state. Rule, hardware and purpose edits bump a shared revision so an old control continuation cannot survive a changed configuration.

Preview snapshots retain entity/array identities because renderers hold references to them. Stopping a preview restores world values, engine counters and simulation tick; reset or a formal start first closes the preview. Preview cannot end a formal run, enter run history, prompt for failure or unlock a stage. Normal learner navigation routes only to current task goals already exposed through mounted sensors. With Vision mounted, a small memory retains positions it actually reported, including an object briefly seen while another goal was handled. Pickup removes that entry; a misplaced release updates its known drop position. Fresh runs reset memory, and unmounted Vision cannot expose it. This prevents forgetting the initial cup without searching hidden object coordinates, changing battery policy or adding an automatic scan/sorting routine. No route action completes cleaning or deposits an object. Missing hardware has no physical effect, and a trace explains an attempted unavailable action.

The original world collision architecture, normal doors, perceived-goal routing, explicit collision reflex, carrying/release behavior, visible bin lids and LED facts remain. The complete action catalog stays available even for a semantically mismatched learner design. Only its task group eligibility and installed actuator gate determine whether a rule can attempt it.

## Editor and view behavior

All 15 sensors and 14 actuators remain selectable with empty initial hardware, 11/10 maximum mounting points and no minimum. Neutral module cards reveal the original name, icon and short description without answer labels. Mounted sensors are labeled on the body preview; procedural actuator assembly and fixed right mounting panel remain. Each library scrolls independently.

Each unlocked task has at least one editable stable-ID rule. Adding rows never pre-fills answers; removing a row never deletes the sole remaining row. Slot placement checks kinds and the separate Flow/priority roles, without semantic validation. SENSE, CONDITION and ACTION shelves preserve 15/20/23 blocks. Flow exposes CTRL_01–04; a separate row selector preserves CTRL_05/06 and allows High/Normal priority with THEN's second Action slot, WAIT or repeat. High candidates precede Normal; queued THEN wins over another Normal primary. Editing preserves both columns and per-shelf scroll offsets. Fired highlights use rule identity, not action identity or row position.

The initial view stays fixed FPS with the workstation closed. FPS, orbit/overhead and camera-bounded Robot POV are available; POV exit restores its saved view/page. There is no normal 2D Map button. The internal canvas supports the miniature rule preview and graceful WebGL/model-load fallback. Dismissing a slow load does not change the chosen view. The single top Workstation control and earlier UI deletions are preserved.

## Feedback, closing and data

Criteria show `Criterion | Observed result | Status` with Achieved, Partially achieved or Not achieved. A nonzero count below the functional target is partial; zero is unmet. Duration and unsafe-encounter counters are factual observations, not points. Locked cat/spill/dock outcomes cannot fail the current mission. No score-driven prompt, grade, weighted total or sound is shown. A reflection appears at most once on a failed formal ending, with choices to review the goal, sensors, rules or actuators and no proposed repair.

Use End run & evaluate to retain evidence and enable stage progression when criteria pass. Stage 1 has a short reflection before its explicit transition; Stage 2 finishes with closing text, a stage-aware outcome summary and Download log. Failed runs may also be closed and exported. Refresh does not persist a session; download its CSV before closing.

The sole CSV schema is `timestamp,step,event,target_id,detail`. State events include stage/task context and order. Task priority changes, purpose edits and rule execution priorities have distinct events. Stable rule IDs appear on edits, removals and firings. Run exports contain factual criteria/settings, configuration, per-task outcomes, world/event counters, elapsed seconds and pass status; score/weight fields are absent. Stage 1 evidence survives Stage 2 and resets. The session is single-learner with no Player A/B fields or synchronization requirements.

## Local checks

Run `node --test tests/*.test.mjs`. The staged integration suite exercises formal/preview pass boundaries, stage carryover, hardware capacities without minima, locked goals/rules, separate priorities, fresh-reset versus pause semantics, unset/configured speed criteria, once-on-failure reflection, stage-aware logs and summary, catalog fingerprints and real rule-driven two-stage cleaning/pickup/release. A default-apartment regression uses ordinary battery and learner-authored rules to clean all dirt and physically sort all four objects in the cumulative stage. Existing geometry, multiple-rule, physical execution and POV checks remain. Browser proof should additionally inspect scroll retention, physical module visuals, available library counts, stage progression, actual criterion display, final summary and exported CSV.
