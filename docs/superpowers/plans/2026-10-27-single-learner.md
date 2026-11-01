# PEASLab2D Single-Learner Implementation Plan

> Execute inline in this session; use executing-plans for implementation.

**Goal:** Preserve the original and provide an independently runnable PEASLab2D copy for one learner.
**Architecture:** Copy the self-contained web application, replace role-dependent state/logging with a single participant, and remove pair-only UI and checkpoints. Preserve the PEAS activities and simulation rules.
**Tech Stack:** Existing vanilla JavaScript modules, HTML/CSS, zero-dependency Node server.
**Spec:** User request in this chat: copy the original, rename to PEASLab2D, remove Player A/B and collaboration features, support individual use.

## Global Constraints
- Original `../CollabPEAS/collabpeas-2d` remains byte-for-byte unchanged.
- Independent copy at `PEASLab2D`, preview on port 8089; no remote changes.
- Keep observation marks, reflection, debug navigation and CSV export usable by one learner.
- Do not change task logic, sensors, actuators, rule evaluation, or scoring.

## Review Focus
- Single-learner identity must reach observations and CSV without role switching.
- Sensor, actuator and rule edits must survive removal of contribution counters.
- Debug actions must navigate immediately, without a partner or timer.
- Step 5 and summary must remain usable with an empty or populated observation record.
- Local runtime dependencies and original files must remain intact.

## Tasks
- [x] Write/run failing Node tests for participant observation attribution, event/CSV attribution and immediate debug navigation.
- [x] Remove role state/counters; convert observation renderer to one list; remove role UI, agreement checkpoint and contribution summaries.
- [x] Rename visible branding and exports; start the existing 2D view by default; update local usage documentation.
- [x] Run `node --experimental-default-type=module --test tests/*.test.mjs` and syntax checks.
- [x] Serve on 8089; verify all five steps, observation marks, debug actions, summary and CSV in the browser.
- [x] Compare source hashes with the pre-copy manifest and leave the modified preview open.

## Verification record
- Three regression tests pass (single identity/editing, real CSV content, immediate debug navigation); all app JS/server syntax checks pass.
- Browser verified default 2D and branding, steps 1–5, sensor and actuator removal/restoration, individual Pass/Uncertain observations, debug return to Sensors and final summary. Reflection click records its event; native alert disrupted the automation before recovery.
- CSV creation/escaping/ParticipantID/filename verified by executing the exporter in a Node test at the browser-download boundary. Actual IAB download completion could not be confirmed: waiting for its download event timed out. This remains a manual browser verification limitation, not a passing download check.
- Fresh independent code review: no actionable introduced regressions.
- Original source SHA-256 manifest: all 30 original files unchanged. No remote repository changes.
- Ruling: preserve optional existing 3D/FPS views but default to 2D; removing view modes is outside the requested collaboration removal.
- Ruling: preserve upstream documents as historical references, with README clarification, instead of rewriting the original study protocol.
