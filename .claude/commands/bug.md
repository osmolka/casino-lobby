---
description: Fix a reported bug with a reproduction first (e.g. /bug Back after ?cat=live&sort=rtp keeps sort=rtp)
argument-hint: <steps, expected, actual>
---

Bug report: $ARGUMENTS

1. Restate the bug in one line: steps, expected, actual. If any of the three is missing, ask me.
2. Reproduce it. For logic bugs write a failing test first; for UI bugs describe the reproduction and add an e2e test if cheap.
3. Find the root cause. Report it in 1–2 lines before changing code.
4. Make the minimal fix. Do not refactor unrelated code.
5. Run `npm run check`. The new test must fail before the fix and pass after.
6. Report in the format from `CLAUDE.md`. Add a line to `PROGRESS.md` only if the fix changes a decision or closes an open issue. Commit as `fix: <summary>`.
