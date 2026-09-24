# Rainbow Kitten

Engels-woordjesspel voor Wyne. Katja klimt tegen de muren omhoog: elk goed woordje is een sprong.
Regels en ontwerp: zie `CLAUDE.md`.

## Draaien

```
npm install
npm run dev -- --host     # testen op telefoon in hetzelfde wifi
npm test                  # Vitest
npm run build             # statische build in dist/
npm run assets            # asset-pipeline: visuals/ -> public/ (+ debug/keying.png, debug/anchors.png)
```

Automatische controle (screenshots op 390x844 en 402x874, twee volledige rondes):

```
npm run build && npx vite preview --port 4173 &
node scripts/check.mjs                 # alles, naar debug/screens/
node scripts/check.mjs -- --walls      # close-up pootjes tegen de muur, links en rechts
node scripts/check.mjs -- --states     # slaapscherm en zinnen-thema
```

## Deploy naar GitHub Pages

1. Op GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   (Niet "Deploy from a branch": dan serveert Pages de ruwe bronbestanden en werkt het spel niet.)
2. Push naar `main`. De workflow `.github/workflows/deploy.yml` draait de tests, bouwt en publiceert `dist/`.
3. Het spel staat op `https://roelandp.github.io/rainbow-kitten/`.
4. Op Wynes iPad of iPhone: openen in Safari, Deel, Zet op beginscherm.

## Altijd de nieuwste versie

- De versie (korte commit-hash) staat onderaan het startscherm en in Instellingen.
- `version.json` wordt bij elke build geschreven. De app kijkt bij openen en bij terugkomen in beeld
  of er een nieuwere versie staat en herlaadt dan (tijdens een ronde pas bij terugkeer naar het startscherm).
- De service worker haalt pagina's altijd vers van het netwerk (`no-store`), laat plaatjes en geluid bij de server
  hervalideren, en gebruikt de cache alleen als er geen internet is. Elke deploy krijgt een nieuwe service worker.

## Nieuwe woorden

- Foto van een nieuwe lijst in `visuals/` en Claude Code vragen die toe te voegen aan `src/content/words.json`, of
- in het spel: Instellingen, Woorden toevoegen, per regel `nederlands;engels`.
