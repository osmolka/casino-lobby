---
description: Run one phase of PLAN.md (e.g. /phase 2a)
argument-hint: <phase-id>
---

Phase: $ARGUMENTS

Phase map (sections of PLAN.md to read; read nothing else from the plan):

| Phase | Sections |
|---|---|
| 1 | §2, §3, §4, §5, §6 "Phase 1" |
| 2a | §3, §5, §6 "Phase 2" → "2a" |
| 2b | §3, §6 "Phase 2" → "2b" and the Phase 2 DoD |
| 3 | §3, §6 "Phase 3" |
| 4 | §3, §6 "Phase 4" |
| 5 | §3, §6 "Phase 5" |
| 6a | §3, §6 "Phase 6" → "6a" |
| 6b | §3, §6 "Phase 6" → "6b" |
| 6c | §3, §7.1 (only if I explicitly approved H5) |
| 7 | §7.2, §8, §9 |

Steps:
1. Read `PROGRESS.md` and the sections above.
2. If an earlier phase is not `done`, stop and tell me.
3. Reply with a plan of max 10 lines: files, functions, test cases, and how each DoD item will be verified. Wait for my OK.
4. Implement. Tests first for pure logic.
5. Run `npm run check` (plus `npm run test:e2e` if the phase adds e2e). Fix until green or until the 3-attempt stop rule.
6. Report in the format from `CLAUDE.md`. For DoD items that need a manual check, list the exact steps for me.
7. Update `PROGRESS.md` and commit as `phase $ARGUMENTS: <summary>`.
