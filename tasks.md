# Tasks, checklist by priority

Source of truth, see `plan.md`.

Legend: `[ ]` To do, `[x]` Done, `(review)` needs review, `(blocked)` blocked.

---

## Priority 1, MVP

* [x] **P1-001, Core loop screens**, Start, Play, Results, Replay, output: `src/ui/core-loop`
* [x] **P1-002, Typing validation baseline**, char level accuracy, command complete detection, output: `src/logic/typing`
* [x] **P1-003, Scoring baseline**, base points, time bonus, error penalties, output: `src/logic/scoring`
* [x] **P1-004, Beginner command pack**, 30 to 50 safe hacker-themed commands with mock outputs, output: `content/packs/beginner.json`
* [ ] **P1-005, Local storage basics**, highscores and simple progress, output: `src/storage/local`
* [ ] **P1-006, Basic audio cues**, correct, error, level up, output: `assets/audio` and `src/audio`
* [ ] **P1-007, Basic animations**, success glow, error shake, output: `src/ui/animations`
* [ ] **P1-008, Onboarding tutorial**, 60 second tutorial, output: `src/ui/onboarding`
* [x] **P1-009, GitHub Pages deployment**, `docs/` or `gh-pages` configured, relative paths verified, output: `deploy/`

---

## Priority 2, Core depth and progression

* [ ] **P2-010, Difficulty split**, packs for beginner, intermediate, advanced, output: `content/packs/*.json`
* [ ] **P2-011, Command metadata fields**, description, tags, variants, mock output, output: `content/schema/command-pack.schema.json`
* [ ] **P2-012, Combo and multiplier UI**, visible meter and effects, output: `src/ui/combo`
* [ ] **P2-013, Progressive hint system**, token, flag, character reveal with costs, output: `src/logic/hints`
* [ ] **P2-014, Results screen tips**, suggest next step based on performance, output: `src/ui/results`

---

## Priority 3, Hacker themed progression

* [ ] **P3-015, Intermediate pack**, curated and safe, output: `content/packs/intermediate.json`
* [ ] **P3-016, Advanced pack**, curated and safe, output: `content/packs/advanced.json`
* [ ] **P3-017, Context blurbs**, when and why to use each command, output: `content/packs/* with description_long`

---

## Priority 4, Modes and stickiness

* [ ] **P4-018, Practice mode**, infinite adaptive practice, output: `src/modes/practice`
* [ ] **P4-019, Daily challenge**, 60 to 90 second seed, streak tracking, output: `src/modes/daily`
* [ ] **P4-020, Speedrun mode**, most commands in 90 seconds, output: `src/modes/speedrun`
* [ ] **P4-021, Scenario lab framework**, short multi step sequences with mock outputs, output: `src/modes/labs`

---

## Priority 5, Scoring, XP, perks and medals

* [ ] **P5-022, Scoring tuning**, difficulty multipliers, combo thresholds, output: `src/logic/scoring`
* [ ] **P5-023, XP and levels**, thresholds and leveling UI, output: `src/logic/xp` and `src/ui/xp`
* [ ] **P5-024, Perks engine**, time freeze, free hint, temporary multipliers, output: `src/logic/perks` and `src/ui/perks`
* [ ] **P5-025, Medals and badges**, milestones and cosmetic badges, output: `content/medals.json` and `src/ui/badges`

---

## Priority 6, Hints and spaced repetition

* [ ] **P6-026, Hint timings and costs**, configuration and UI feedback, output: `src/logic/hints`
* [ ] **P6-027, SRS scheduler**, per command intervals and ease factors in local storage, output: `src/logic/srs`
* [ ] **P6-028, Review sessions**, 60 second weak spot drills, output: `src/modes/review`

---

## Priority 7, UI, UX and accessibility

* [ ] **P7-029, Terminal simulator polish**, fonts, contrast, responsive layout, output: `src/ui/terminal`
* [ ] **P7-030, Command card**, purpose, usage, tags, variants, sample output, output: `src/ui/command-card`
* [ ] **P7-031, Keyboard heatmap**, problem keys and tokens, output: `src/ui/analytics-heatmap`
* [ ] **P7-032, Accessibility pass**, keyboard only flow, focus states, output: `docs/accessibility.md`

---

## Priority 8, Social and meta

* [ ] **P8-033, Leaderboards opt in**, day and week boards, output: `src/social/leaderboard`
* [ ] **P8-034, Friend duels**, share and play the same seed, output: `src/social/duels`
* [ ] **P8-035, Leagues**, groups of 20, weekly reset, output: `src/social/leagues`
* [ ] **P8-036, Cosmetic themes and sound packs**, cosmetic only, output: `content/themes.json` and `src/ui/themes`

---

## Cross cutting, tests and performance

* [ ] **T-037, Unit tests**, scoring, typing, hints, SRS, output: `tests/unit/*`
* [ ] **T-038, E2E tests**, core flows and modes, output: `tests/e2e/*`
* [ ] **T-039, Performance budget**, asset size, latency, CI checks, output: `docs/performance.md` and CI config

---

## Review checklist per PR

* Builds and runs on GitHub Pages, relative paths verified
* Meets performance budget, no layout shifts on input
* Tests pass locally, smoke test for modes affected
* Documentation updated in `plan.md` and, if relevant, in `docs/`

---

## Optional tracking

If you prefer a log, add `generated_log.md` entries per task with date, branch, commit, prompt reference.
