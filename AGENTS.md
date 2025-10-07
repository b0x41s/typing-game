# Repository Guidelines

## Project Structure & Module Organization
HackType is delivered as a static root `index.html` served with `css/style.css`, `assets/icons.svg` en `data/words.txt` (200+ commands). Gameplay-logica zit in `src`: `src/main.js` koppelt onboarding en core loop, `src/ui` bevat modules (`core-loop`, `onboarding`, `animations`), `src/logic` huisvest scoring- en typing-engines, `src/storage/local` beheert persistentie, `src/audio` speelt cues, en `src/data/packs.js` laadt de command packs. Content packs wonen in `content/packs` met `manifest.json` als lijst van beschikbare packs. Automatiseringsconfiguratie staat onder `.github/workflows/deploy.yml` en hulpscripts in `scripts/`. Houd `plan.md` en `tasks.md` synchroon met roadmapwijzigingen.

## Build, Test, and Development Commands
Draai lokaal een server vanuit de repo-root zodat fetch-verzoeken slagen:
- `python3 -m http.server 8080` – snelle statische server met Python.
- `npx http-server -p 8080` – Node-alternatief, installeert bij eerste run.
Gebruik de deploy-helper `./scripts/push.sh "feat: concise summary"`; deze staged, commit en pusht naar de geconfigureerde remote.
Handmatige smoketests: laad `http://localhost:8080`, speel een volledige run en start opnieuw na het legen van `localStorage` om onboarding te controleren.

## Coding Style & Naming Conventions
Volg `.editorconfig`: UTF-8, LF, twee spaties en geen trailing whitespace. Schrijf beknopte Nederlandstalige comments voor niet vanzelfsprekende logica. Kies beschrijvende file-scoped functies (bijv. `setupKeyboardHints`) en camelCase voor JS-identifiers, kebab-case voor assetnamen, lowercase-hyphen ID's/classes in CSS. CSS leeft in `css/style.css`; hergebruik de bestaande CSS-variabelen voor kleuren en spacing.

## Testing Guidelines
Automated tests staan gepland maar ontbreken nog. Plaats toekomstige unit-specs in `tests/unit` met dezelfde structuur als `src`, en integratieruns in `tests/e2e`. Gebruik de ingebouwde Node 18 testrunner (`node --test tests/unit`) of Playwright voor browserchecks. Dek timer edge cases, caps-lock detectie, onboarding-afronding en storage-fallbacks af voordat je taken afrondt. Documenteer nieuwe scripts in de README.

## Commit & Pull Request Guidelines
Gebruik conventionele prefixen zoals `feat:`, `fix:` en `chore:`. Houd subjects ≤60 karakters en schrijf imperatieve bodies waar nodig. Voer altijd een lokale smoketest uit voor je `./scripts/push.sh` draait. Licht PR's toe met doel, geraakte modules, voor/na screenshots of GIF's voor UI-wijzigingen, link de relevante task-ID's (bijv. `P1-008`) en noteer testbewijsmateriaal. Werk `plan.md`, `tasks.md` en eventuele content packs bij zodat reviewers de scope kunnen volgen.
