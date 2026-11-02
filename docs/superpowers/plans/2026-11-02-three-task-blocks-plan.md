# Three-task structured block editor Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement the integrated task, then independent review.

**Goal:** Replace four-slot authoring with executable nested blocks and the approved Overview + three cumulative household tasks, locally.
**Architecture:** Extend current single learner state, engine and views in place. Preserve existing primitive IDs and physical/perception behavior; add an explicit program tree and structured editor, using locally vendored Blockly when appropriate. Keep compatibility for existing primitive-focused tests where reasonable; update old workflow assumptions explicitly.
**Tech Stack:** Static HTML/CSS/JavaScript, existing Three.js, Node test runner, locally vendored block UI.
**Spec:** docs/superpowers/specs/2026-11-02-three-task-blocks-design.md

## Global Constraints
Work locally only; no GitHub push and no deployment. Three stages Vacuum TASK_1 -> Spills TASK_3 -> Sorting TASK_2; common TASK_4/5/6 active from first stage. Budgets 7/8/11, no minimum, 10 actuator positions. Initial test battery 35%, LOW30%, log settings. Full original library and stable IDs retained. Empty learner designs; no provided correct solution. Preserve collision, light theme, POV, bilingual language-only switch and canonical logs/user text. No runtime CDN.

## Review Focus
- Repeated/nested loops must yield and cannot freeze UI; priority guards interrupt running work and waits correctly.
- Missing sensors with AND/OR/ELSE must not produce knowledge or execute false-safe branches.
- Step/stage changes, preview, reset, edits and language switches preserve the intended authored data while invalidating only stale runtime.
- Final pass requires all three cumulative functions + safety + physically demonstrated docking in one run, not prior run grades added up.
- New graph editor must truly snap/nest/reorder, resize inside modal, retain viewport on language toggle, and match executed/logged program.

### Task 1: Integrated structured authoring and cumulative workflow
**Files:** Modify js/pilot-config.js, js/state.js, js/sim/engine.js, js/view/block-canvas.js, js/view/steps-view.js, js/app.js, index.html, js/i18n*.js, styles/light.css and associated scoped styles; add small program/editor modules and local vendor assets if needed. Update README.md and docs/STAGED_PILOT.md to current behavior. Tests in tests/ for new program behavior, three-stage workflow, primitive contracts, browser interactions.
**Interfaces:** Existing appState remains source of hardware, stages, authored rules/programs and canonical event records. SimulationEngine remains the single physical executor. Editor consumes state, emits stable tree changes, highlights active nodes; no independent shadow execution.
- [ ] Read spec and current source/fixtures; choose smallest serializable AST and editor integration matching it; record decisions in task report.
- [ ] Write new failing evaluator/workflow tests first and verify RED for actual missing features.
- [ ] Implement state, AST/runtime and local block authoring; preserve correct old primitive behavior and all retained catalog entries.
- [ ] Implement Overview, three cumulative stages/common requirements, budgets, reproducible battery and language coverage. Preserve previous task edits during advance.
- [ ] Update obsolete tests to new explicit stage requirements, add genuine real-world authored combined solution, execute full suite and browser QA. Fix observed issues only.
- [ ] Document operational defaults/limits, self-review, commit only isolated copy, report exact tests and changed behavior.

### Task 2: Independent review, source handoff and final verification
- [ ] Review full baseline-to-HEAD diff against spec; independent spec and quality verdicts with actionable findings.
- [ ] Resolve findings, scoped re-review, full suite if code changes justify, actual source browser verification.
- [ ] Verify source originals still match baseline, back up affected files and copy reviewed changes to real source; do not commit/push/publish real source.
- [ ] Start/reuse localhost:8089, test source checkout, open local site, report completed behavior and material limits.
