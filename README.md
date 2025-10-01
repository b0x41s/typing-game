# HackType

https://b0x41s.github.io/typing-game

HackType is een statische 60-seconden typchallenge met een donkere Tex-Tribe uitstraling. Train je 10-vinger blindtypen en houd WPM en accuracy strak in de gaten zonder afhankelijkheden of build-stap.

## Features
- Hacker-achtige UI met neonaccenten, scanlines en responsief gedrag van 320px tot breed desktop.
- 60s countdown met live WPM (5-cpm norm) en accuracy op basis van alle ingevoerde tekens.
- Woordrotatie over 300+ tech/hacker termen, zonder herhaling tot een volle ronde voorbij is.
- Toets-achtige inputfeedback met groene prefix-highlights en subtiele foutmelding.
- Caps Lock waarschuwing zodat je niet per ongeluk in kapitalen blijft hangen.
- Visueel toetsenbord dat meeloopt met je aanslagen voor snelle blik naar vingerpositie.
- Volledig client-side: werkt offline, geen externe bibliotheken of fonts nodig.

## Hoe speel je
1. Open de site in je browser en klik `Start`.
2. Typ het woord dat wordt weergegeven. Gebruik de spatie of direct de laatste letter om te voltooien.
3. Na een juiste invoer krijg je automatisch een nieuw woord.
4. Na 60 seconden stopt de run en verschijnt je eindscore. Druk `Enter` om opnieuw te starten of gebruik `Reset` om te herinitialiseren.

## Lokale ontwikkeling
Gebruik een simpele webserver zodat `fetch` voor de woordenlijst werkt.

```bash
# optie 1: standaard Python
python3 -m http.server 8080

# optie 2: Node http-server
npx http-server -p 8080
```

Open daarna [http://localhost:8080](http://localhost:8080) in je browser en navigeer naar `index.html`.

## GitHub Pages deploy
1. Maak een repository op GitHub en push deze code naar de `main` branch.
2. Activeer GitHub Pages onder Settings → Pages en kies "GitHub Actions" als bron.
3. Iedere push naar `main` triggert `.github/workflows/deploy.yml` die de root van de repo publiceert.

## Troubleshooting
- **Geen woorden geladen**: controleer of je via een http(s)-server werkt; direct openen vanaf het filesystem blokkeert `fetch`.
- **Timer pauzeert**: de timer stopt bewust wanneer de tab onzichtbaar is (focusverlies of minimaliseren) om valse tijden te voorkomen.
- **Scores ogen laag**: WPM gebruikt de standaard definitie (correcte tekens / 5). Als je veel corrigeert daalt accuracy en dus je WPM.
- **Git push faalt**: check of je upstream remote goed staat, of zet deze met `git remote add origin <url>` en probeer opnieuw met `scripts/push.sh`.

## Licentie
Dit project valt onder de MIT-licentie (zie `LICENSE`).
