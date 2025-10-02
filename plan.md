# Project: Ten Fingers Hacker Typing Game

**Goal:** A highly engaging, educational web game where players learn real, hacker-themed command line (OSCP) skills by typing authentic commands with speed and accuracy. Hosted as a static site on GitHub Pages.

**North Star metric:** Correct hacker commands typed per player per week, and 7 day return rate.

---

## Design pillars

1. Teach, then test, then review, short cycles of 60 to 180 seconds
2. Progressive complexity, from basic commands to realistic, multi step scenarios
3. Flow and fun, rapid feedback, micro rewards, fair challenge, zero dead ends
4. Safety first, simulated terminal, deterministic, non destructive outputs
5. Privacy first, opt in for any shared leaderboards or analytics

---

## MVP, Priority 1

Deliver a fully playable, offline friendly static site.

**Scope**

* Core loop: start, play, result, replay
* One beginner command pack, 30 to 50 commands, hacker themed like OSCP
* Typing validation with character level accuracy, command level scoring
* Local storage for high scores and basic progress
* Basic audio cues for correct, error, level up
* Basic animations for success and error
* Onboarding with 60 second tutorial
* Deployment on GitHub Pages, documented in the repo

**Success criteria**

* First playable within 2 clicks, time to first reward under 60 seconds
* Performance: initial load under 2 seconds on a typical laptop, interaction latency under 100 ms
* Accessibility: keyboard only flow, visible focus, scalable fonts

---

## Priority 2, Core depth and progression

Add structured learning and replay value.

* Command packs split by difficulty: beginner, intermediate, advanced
* Command metadata: `command, description_short, description_long, difficulty, tags, accepted_variants, mock_output`
* Combo and multiplier mechanics with visible meter
* Progressive hint system: token, flag, character reveals, small score cost per hint
* Result screen with tips and suggested next step

---

## Priority 3, Hacker themed command progression

Teach realistic, hacker commands used in security work or like OSCP.

**Beginner examples**

* `ls`, `id`, `whoami`, `env`, `pwd`, `cat /etc/os-release`

**Intermediate examples**

* `ls -ltra`, `grep -R "pattern" .`, `curl -I http://example.com`, `awk '{print $1}' file.txt`

**Advanced examples**

* `nc -nlvp 8443`, `python3 -m http.server 8000`, `ssh user@host -p 2222`, `nmap -sC -sV -p- target`

**Pack rules**

1. Prefer information gathering.
2. Provide accepted variants, for example `ls -l` and `ls -la`
3. Provide short context on when and why a command is useful
4. Each command has a deterministic mock output that feels real

---

## Priority 4, Modes and stickiness

Increase variety without fragmenting focus.

* Practice mode, infinite practice with adaptive difficulty
* Daily challenge, single 60 to 90 second seed, streak rewards
* Speedrun, most commands in 90 seconds
* Scenario labs, short multi step flows like quick recon or file serve, fully simulated

---

## Priority 5, Scoring, XP, perks and medals

Deepen motivation with clear, fair rewards.

**Scoring**

* Base points per correct command, time bonus tiers, error penalties
* Difficulty multipliers per pack
* Combo multiplier after streak milestones

**XP and levels**

* XP equals a fraction of score, level every defined XP threshold
* Level ups grant perk points

**Perks, tactical and time boxed**

* Free hint, reduce hint cost for 1 run
* Freeze timer for 3 seconds
* Temporary +10 percent score multiplier

**Medals**

* Milestones such as 100 different commands, 10 perfect runs, late night streak
* Cosmetic badges only, no pay to win

---

## Priority 6, Hints and spaced repetition

Improve retention and reduce forgetting.

* Progressive hints unlocked by time or errors, minimal frustration
* Spaced repetition scheduling per command, store ease factor and interval in local storage
* Review sessions that prioritize weak commands, short 60 second sets

---

## Priority 7, UI, UX and accessibility polish

Make it feel great and inclusive.

* Terminal simulator with fixed font, clear contrast, responsive layout
* Command card with purpose, usage, tags, variants, sample output
* Visual rhythm, gentle glow on flow, shake on error, confetti on milestones
* Keyboard heatmap and problem tokens, personal practice suggestions

---

## Priority 8, Social and meta

Add optional social loops and long term retention.

* Opt in leaderboard, per day and per week, fair seeding
* Friend duels on the daily seed, asynchronous
* Small leagues of 20 players, weekly reset
* Cosmetic themes and sound packs, cosmetic only

---

## Architecture and hosting, high level

* Static site, SPA or classic pages with client side state
* Bundler, for example Vite, or plain static assets for maximum simplicity
* Audio, Web Audio API or a small library
* Storage, localStorage for progress and SRS, optional Firebase for leaderboards
* Hosting, GitHub Pages using `docs/` or `gh-pages` branch, HTTPS

---

## Analytics and privacy baseline

* Privacy first, opt in only, minimal event set
* Track, per command: time to complete, error count, hint usage
* Track session length, return rate, drop points in onboarding

---

## File structure, conceptual

* `index.html`, entry point and static assets
* `assets/`, audio, images, fonts
* `src/`, scripts, game logic, UI components
* `content/`, command packs in JSON or YAML, safe and versioned
* `docs/` or `gh-pages` deployment target
* `plan.md`, this document

---

## Deployment on GitHub Pages, checklist

* Build to `docs/` on main, or publish to `gh-pages` branch
* Use relative paths so the site works from `https://<user>.github.io/<repo>/`
* Verify offline fallback for the game shell if feasible
* Performance check, minimal assets, compression enabled

---

## Playtesting plan

* Three 10 minute sessions, onboarding, daily, scenario lab
* Measure time to first reward, error rates, hint usage
* Collect qualitative notes on frustration and delight

---

## Risks and mitigations

* Player frustration, solved with progressive hints and soft fails
* Scope creep, solved with strict priority layers and small tasks
* Performance on low end devices, solved with minimal assets and simple effects

---

## Tasks overview by priority

This section maps features to small, independent tasks ready for generation.

**Priority 1, MVP**

* Core loop screens, typing validation, scoring baseline
* Beginner command pack with mock outputs
* Local storage for score and simple progress
* Audio cues and basic animations
* Onboarding tutorial and Pages deployment

**Priority 2**

* Difficulty split packs, metadata and accepted variants
* Combo and multiplier UI
* Result tips and suggested next step

**Priority 3**

* Intermediate and advanced packs, curated and safe
* Context blurbs for when and why to use each command

**Priority 4**

* Practice mode, daily challenge, speedrun
* Scenario lab framework with multi step sequences

**Priority 5**

* XP, levels, perks and medals, UI and storage

**Priority 6**

* Progressive hints engine and SRS scheduler
* Review sessions and weak spot drills

**Priority 7**

* UI polish, accessibility pass, keyboard heatmap

**Priority 8**

* Leaderboards, duels, leagues, cosmetic themes

---

## Definition of done per feature

* Runs on GitHub Pages, links work with relative paths
* Performance budget respected, no layout shifts on input
* Unit tests for scoring and parsing, smoke tests for modes
* Documentation updated in `plan.md`

---

## First actions, immediately actionable

1. Commit this `plan.md` as the single source of truth
2. Derive `tasks.json` from the Tasks overview by priority
3. Stand up GitHub Pages via `docs/` or `gh-pages`
4. Implement Priority 1 end to end, then iterate priority by priority
