# Project: Ten Fingers Hacker Typing Game

**Goal:** A sticky, educational web game where players type real shell commands with ten fingers, earn points, unlock perks and medals, with audio and animations, so they build command line skills in a playful way.

---

## MVP

1. Core gameplay, one playable round with a beginner command set
2. Scoring based on speed and accuracy
3. Start screen, play screen, results screen
4. Local high score storage in the browser
5. Simple audio feedback for success and errors
6. Basic animations for correct and incorrect input

---

## Command progression and hacker theme

Commands should be themed around real tools and syntaxes that security practitioners and hackers commonly encounter, starting simple and increasing in complexity as the player improves. Include clear difficulty tags per command and avoid destructive or malicious instructions. Example progression, from beginner to advanced:

* **Beginner:** `ls`, `id`, `whoami`, `env`, `pwd`, `cat /etc/os-release`
* **Intermediate:** `ls -ltra`, `grep -R "TODO" .`, `curl -I http://example.com`, `awk '{print $1}' file.txt`
* **Advanced / Hacker-themed:** `nc -nlvp 8443`, `python3 -m http.server 8000`, `ssh user@host -p 2222`, `nmap -sC -sV -p- target`

Design rules for command packs:

1. Tag each command with difficulty and category, for example: beginner, intermediate, reconnaissance, exploitation, post-exploitation
2. Prefer information gathering and safe commands, avoid destructive flags like `rm -rf` or commands that instruct social engineering
3. Provide expected typing forms and acceptable variations, for example `ls -l` and `ls -la` both accepted if intended
4. Reward faster, error-free typing with higher scores and combos

---

## Priorities and roadmap

**Priority 1, required for a playable version**

* Full gameplay loop, input validation, and scoring
* Local storage for high scores and player progress
* Clear UI and UX for short runs
* Simple audio and animation feedback

**Priority 2, retention and stickiness**

* Perks and medals, progression with XP and levels
* Multiple levels with growing difficulty and timers
* Combo and multiplier mechanics

**Priority 3, social and long term retention**

* Opt in leaderboard via a lightweight backend or Firebase
* Daily challenges and streak rewards
* Themes and unlockables

**Priority 4, polish and analytics**

* Particle animations, fine tuning of audio mix
* Keyboard heatmap for practice feedback
* E2E tests and performance tests

---

## Hosting on GitHub Pages, requirements and options

The game must be fully playable as a static site on GitHub Pages, no installation for players.

**Option A, static build in `docs/`**

* Place the compiled static assets in a `docs/` folder on the `main` branch, enable GitHub Pages in repository settings, choose the `docs/` folder as the source. Easiest route for static sites.

**Option B, `gh-pages` branch**

* Publish the site to a dedicated `gh-pages` branch. Use a simple deployment step or a workflow to push build artifacts from `main` to `gh-pages`.

**Option C, GitHub Actions build and deploy**

* Configure a workflow that builds on push to `main`, then pushes artifacts to `gh-pages` or `docs/`. Recommended when a bundler is used.

**Important notes for GitHub Pages**

* Deliver as static assets, no server side runtime
* Ensure relative asset paths, so the site works from `https://<user>.github.io/<repo>/` or a custom domain
* Use HTTPS, enable caching and asset optimization for quick loads

---

## Architecture and tech stack, high level

* Frontend: single page application or static site, choose React, Vue, or plain JS
* Asset management: bundler like Vite for fast builds, or direct static files for maximum simplicity
* Audio: Web Audio API or Howler.js, implementation detail
* Storage: localStorage for single player progress, optional Firebase or Firestore for opt in leaderboards
* CI and CD: GitHub Actions to build and deploy to GitHub Pages

---

## File structure, conceptual

* `index.html`, `assets/`, `dist/` or `docs/`, `src/`, `plan.md`
* Keep build output separate from source code, deployment stays simple

---

## Step by step task list

1. Add `plan.md` to the repository, treat this document as the single source of truth
2. Initialize project structure and package manifest, configure a bundler if desired
3. Build base UI screens and implement input and validation
4. Implement scoring and local storage
5. Add audio and simple animations
6. Test locally and optimize load time
7. Configure GitHub Pages deployment, choose Option A or Option C based on your build step
8. Polish, add perks, medals, and retention features

---

## Deployment checklist for GitHub Pages

* [ ] All static assets present in `docs/` or built to `gh-pages`
* [ ] Repository settings, Pages, correctly set to `docs/` or `gh-pages`
* [ ] Relative asset paths verified at `https://<username>.github.io/<repo>/`
* [ ] CI workflow verified, build and deploy successful
* [ ] Performance checked, minimal assets and compression enabled

---

## QA and tests

* Unit tests for scoring and input validation
* End to end tests for the main flows, use Playwright or Cypress
* Manual checks on mobile and desktop, focus on the keyboard experience

---

## Metrics and success criteria

* Retention, percentage of players that return within 7 days
* Average run length, average score, unlocks per player
* Performance, initial load under 2 seconds for the start page, interaction latency under 100 ms

---

## First actions, immediately actionable

1. Commit this `plan.md`
2. Choose a hosting option, `docs/` for direct publishing, or a workflow for automated build and deploy
3. Create the first issue, "Core gameplay and GitHub Pages deployment"
4. Iterate feature by feature, keep branches and PRs small
