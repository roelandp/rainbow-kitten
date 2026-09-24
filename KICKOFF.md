# Kickoff

## Voorbereiden op de Mac

Naast de map van Kit Nugget (Claude Code kopieert daaruit):

```
mkdir -p rainbow-kitten/visuals
cd rainbow-kitten && git init
```

1. `CLAUDE.md` en `ASSETS.md` in de root
2. Alles uit Gemini, `katja.jpeg`, de foto van de woordenlijst en eventuele opnames in `visuals/`, namen maken niet uit
3. Staat Kit Nugget niet op `../kit-nugget-klimt`, pas dat pad aan in CLAUDE.md
4. `claude` starten in de map

## Prompt voor Claude Code

```
Lees CLAUDE.md en ASSETS.md volledig. Bouw het hele project in een run volgens de fases in CLAUDE.md, in die volgorde. Kopieer engine, storage, audio, asset-pipeline, PWA-config en de iOS-fixes uit ../kit-nugget-klimt en bouw ze om naar woordparen en muren. Neem de woordenlijst letterlijk over van de foto in visuals/. Draai de asset-pipeline op visuals/: bekijk elk bestand zelf, benoem het, en bekijk debug/keying.png en debug/anchors.png tot de witte vacht schoon is en de items goed op Katja zitten. Besteed extra zorg aan de hang-poses tegen de muur: pootjes precies tegen het muuroppervlak, links en gespiegeld rechts, controleer met een screenshot als dat kan. Wyne's regels in CLAUDE.md niet aanpassen of vereenvoudigen. Ontbreekt een asset, gebruik de fallback en ga door. Commit per werkend onderdeel. Rapporteer aan het eind wat af is, wat op fallback draait, de volledige woordenlijst met twijfelgevallen, en hoe ik deploy naar GitHub Pages.
```

## Daarna

- Testen op telefoon in hetzelfde wifi: `npm run dev -- --host`
- Deploy naar GitHub Pages zoals Kit Nugget, dan installeren op Wynes apparaat via Deel, Zet op beginscherm
- Nieuwe woordenlijst van school: foto in `visuals/` en vraag Claude Code die toe te voegen, of plak `nl;en` regels in Instellingen
