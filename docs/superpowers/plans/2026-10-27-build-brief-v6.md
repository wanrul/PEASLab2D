# PEASLab2D v6 implementation ledger
Source: supplied CollabPEAS_2D_Build_Brief.md.docx, extracted in docs/BUILD_BRIEF_V6.txt.
Scope: existing independent PEASLab2D copy; original CollabPEAS stays unchanged. Keep catalogs, collision fixes, aligned map and comfort camera.
1. State, logging and engine: empty mounts/rules, six fixed tasks, count gates/unlocks, five-column event CSV, weighted scores matching actual engine semantics, run lifecycle and reflection signal.
2. Learning editors: neutral randomized cards, physical mounting slots and assembly preview; typed six-zone block editor, no semantic validation, live trace preview.
3. World views: consistent hotspots/objects, sensor-bounded POV, FPS turning and event audio.
4. Shell and Steps 1/5: concise learner copy, weights preview, numeric gates, dashboard, single stamps, edit jumps, reflection and closing summary.
5. Integrate, test actual empty-start-to-finish flow and regress collision/camera; inspect browser and export.
Ruling: use brief's explicit defaults for open decisions (8–11 sensors, empty rules, one reflection per run). Preserve engine scoring where brief says hover text should match it; do not invent calibrated research penalties.
Ruling: 'nothing pre-selected' applies hardware and rules; weights retain editable 35/25/20/20 distribution totaling 100.
Status: implemented and verified.
Verification: 42 Node tests pass, including count gates, empty initial state, type-only blocks, CSV escaping, preview isolation/object identity, run history/reflection lifecycle, collisions and camera. Browser walked Step1→sensor mounts→POV entry/exit→actuator mounts→empty rule editor→self-built rule→Run→Finish→closing draft persistence→summary. No browser error logs. No-vision mask measured 1280×720 at viewport size 1280×720. Original 30-source-file manifest unchanged.
Review fixes: restore simulation state after preview; preserve preview speed mode; forbid runs after Finish; clear stale reflection; log run endings in Step5; resume preview when revisiting rules; keep closing draft; full viewport sensor mask; narrow layout breakpoint.
Limits preserved explicitly: Time is battery per existing engine (not 120-second elapsed-time scoring); light/lux and contact mass have no world source and display dash; procedural body assembly geometry used in lieu of unavailable model-specific assets. README documents these for researchers.
