# Review Fixes

Addresses code review findings from 2025-01-27-143022-review.md.

## Status: completed

## Fixes Applied

1. **Tea ceremony skip loop** - Separated the "find next valid player" scan from the "have all players had a turn" counter. The scan loop no longer mutates `teaTurnIndex` during iteration. Instead, it counts skipped players separately and applies the count to `teaTurnIndex` only after the scan completes. This prevents premature phase advancement when `teaTurnIndex` is already close to `players.length`.

2. **Temple figures not remapped** - Added a loop in `startLobbyGame` (src/server/index.ts) to remap `temple.figures[].playerId` using the same `idMap` that remaps province figures and honor track entries. This ensures future safety if temples are ever populated before the remap runs.

3. **Username matching fragility in resumeGame** - The `PLAYER_ID` WebSocket handler now persists the assigned playerId to localStorage (`shoguns-ascent-playerId`). The `resumeGame` function now tries matching by stored playerId first, then falls back to username match if no playerId match is found.

Issue #4 (autoAssignClan defaults) was explicitly excluded per instructions.
