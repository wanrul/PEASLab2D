# Learner navigation Implementation Plan

> **For agentic workers:** use superpowers:executing-plans inline.

**Goal:** make all navigation and task decisions learner-authored with three cumulative tasks.
**Architecture:** retain the world/UI, replace hidden motion with primitive commands, extend the structured interpreter and Blockly compiler, and use factual recorded-map/progress reads.
**Tech Stack:** browser JavaScript, Blockly, node:test, Playwright.
**Spec:** docs/superpowers/specs/2026-11-13-learner-navigation-design.md

## Global Constraints
Local only, no commits/push. Preserve dirty source by staging/guarded copyback. Automatic memory only; never insert answer logic. Unknown is not false. Four categories. No route penalty.

## Review Focus
- No-program robots remain stationary even with navigation hardware.
- Independent tools/velocity can execute together without lower-priority motion overriding STOP.
- No global map or unmounted channels leak into learner readings.
- Reset/preview/revisions preserve or clear memory intentionally.
- Existing blocks carry forward while new scaffolds appear once per stage.

## Tasks
- [x] 1. Write failing learner contract tests: stage order, idle motion, automatic memory, configurable values, tool concurrency, coverage thresholds and mop contact.
- [x] 2. Implement task definitions, criteria and Purpose/Overview/hardware alignment.
- [x] 3. Add bounded expression/statement runtime and numeric sensor/record reads; remove hidden drive/reflex; verify test-first.
- [x] 4. Four-category Blockly library, blank editable shells, stage carry-forward, procedure/data controls; keep modal canvas.
- [x] 5. Bilingual copy, preview hardware and browser regression including genuine drag/drop and execution.
- [x] 6. Run suite, review diff, guarded copyback, verify local8089 and open preview.
