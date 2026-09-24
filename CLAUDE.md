# Rainbow Kitten

Engels-woordjesspel voor Wyne (7). Zusje van Kit Nugget Klimt: zelfde look & feel en motor, andere kat, andere klimwereld, andere inhoud. Katja, Wynes echte kitten, klimt tegen muren omhoog. Elk goed woordje is een sprong. Doel: Engelse woordjes voor de toets op school.

Bedenker van het spel: Wyne. Haar regels (hieronder gemarkeerd met **Wyne**) gelden en worden niet wegoptimaliseerd.

Taal: alle teksten in het spel simpel Nederlands, korte zinnen, grote letters. Engels alleen bij de woorden zelf. Titel: "Rainbow Kitten". Naam van de kat altijd "Katja", nooit "de kat". Code en comments Engels. Geen em-dashes in teksten.

Toon: nooit straffend. Geen rood, geen buzzer, geen game over, nooit vallen, altijd vooruit. Geen zichtbare tijdsdruk.

## Stack

Identiek aan Kit Nugget Klimt (`../kit-nugget-klimt`, pad aanpassen als het anders is):

- Vite + TypeScript, vanilla (geen React), Three.js, Vitest, vite-plugin-pwa, sharp (dev)
- Geen backend, geen accounts. `base: './'`, statische build in `dist/`, deploy op GitHub Pages zoals Kit Nugget
- Kopieer uit Kit Nugget: `engine`, `storage`, `audio`, `scripts/assets.ts`, PWA-config, iOS-fixes. Vervang `scene` (muren i.p.v. paal) en `ui` (drie woordknoppen i.p.v. numpad). Pas de engine aan van sommen naar woordparen, de logica blijft.

## Structuur

```
visuals/          alles wat Roeland aanlevert, ongesorteerd: Gemini-plaatjes, katja.jpeg,
                  foto van de woordenlijst, opnames purr/meow. Nooit aanpassen, alleen lezen.
scripts/assets.ts pipeline: herkennen, benoemen, keyen, schalen, exporteren
src/
  engine/   woordkiezer, status per woord. Pure TS, geen DOM, geen Three
  game/     ronde, sprongteller, items, finale, dagdoel, records
  scene/    Three.js: muren, richels, camera, Katja met item-lagen, effecten, achtergrond
  ui/       woordkaart, drie knoppen, leerkaart, woordenkaart, verzameling, menu
  audio/    WebAudio synth, samples, SpeechSynthesis
  storage/  load/save/migrate
  content/  words.json, items, zones
public/
  sprites/ items/ bg/ textures/ misc/ audio/   output van de pipeline
debug/      controleplaatjes van de pipeline (niet in de build)
```

Regel: `engine` weet niks van graphics. `scene` weet niks van woorden, krijgt alleen events: `jump`, `crossJump`, `stay`, `itemReached(id)`, `zoneChanged(id)`, `finale(confetti: boolean)`.

## Stap 0: asset-pipeline

Bekijk elk bestand in `visuals/` zelf, bepaal wat het is, geef het de juiste naam. Verwacht:

| Doel | Naam | Bron |
|---|---|---|
| Stijlreferentie | poster, sheet | poster "Rainbow Kitten" en character sheet Katja |
| Foto echte kat | katja | foto, alleen referentie |
| Katja aan de muur, ogen open, w-mondje | hang | groen, pootjes tegen onzichtbare muur links |
| idem, verbaasd, o-mondje | surprised | groen, zelfde lijf als hang |
| idem, ogen dicht, grote lach | happy | groen, zelfde lijf als hang |
| Katja springt omhoog | jump | groen |
| Katja opgerold slapend | sleep | groen |
| idem, ogen half open | wake | groen, optioneel |
| Katja rechtop, pootjes tegen elkaar | beg | groen |
| Katja blij met regenboogsterretjes en confetti | confetti | groen |
| Items | items-sheet, uitsnijden naar cape, mouse-toy, crown, party-hat, bow | 1 plaatje, groen, raster 3+2 |
| Muurtexturen | textures-sheet, uitsnijden naar wall-wallpaper, wall-wood, wall-brick, wall-cloud, wall-metal | 1 plaatje, raster 3+2 met witte naden |
| Achtergronden | bg-title, bg-woonkamer, bg-zolder, bg-dak, bg-wolken, bg-ruimte | 9:16, optioneel |
| App-icoon | icon | vierkant, geen groen |
| Woordenlijst | wordlist | foto van school, zie Woordjes |
| Geluid | purr, meow | opnames echte Katja, optioneel |

Pipeline (`npm run assets`):
1. Groen wegkeyen in HSV met tolerantie (Gemini-groen is niet exact #00FF00, eerder rgb(20,190,40) met verloop). Rand 1 tot 2 px feather. Katja heeft een witte snuit, borst en pootjes: agressieve green despill op alle randpixels en controleer dat de witte en oranje vacht niet groenig blijft. Zet na het keyen elke sprite op een donkere en een lichte achtergrond in `debug/keying.png` en bekijk dat plaatje.
2. `hang`, `surprised`, `happy`: NIET trimmen. Schaal naar exact hetzelfde canvas (grootste van de drie). Meet per plaatje de meest linkse dekkende kolom (waar de pootjes de muur raken). Afwijking groter dan 2 px corrigeren met horizontale offset. Schrijf `wallContact` (fractie van de breedte) naar `public/sprites/sprites.json`.
3. `items-sheet`: keyen, losse voorwerpen uitsnijden via connected components, elk uitgesneden plaatje bekijken en benoemen (cape, mouse-toy, crown, party-hat, bow). `textures-sheet`: de 5 vierkanten vinden via de witte naden, 2 tot 4 px naar binnen bijsnijden zodat er geen wit meekomt, benoemen op volgorde (wallpaper, wood, brick, cloud, metal) en elk vierkant bekijken.
   Overige sprites en items trimmen met 4 px marge.
4. Item-ankers: bekijk elke pose en bepaal per pose de ankerpunten `head` (bovenop de kop, tussen de oren), `neck` (onder de kin) en `back` (midden op de rug), elk met x, y (fractie), rotatie en schaal ten opzichte van de kopbreedte. Schrijf naar `sprites.json`. Render `debug/anchors.png`: elke pose met alle vijf items tegelijk aan. Bekijk het en stel bij tot het klopt.
5. Sprites en items naar webp met alpha, max 768 px hoog. Achtergronden webp q80, max 1080x1920. Texturen 512x512, tileable maken met mirror-tiling als de randen niet aansluiten. Icon naar 192, 512 en 180 (apple-touch-icon) png.
6. Ontbrekende achtergronden: neem ze over uit `../kit-nugget-klimt/public/bg/`. Muziek en synth ook uit Kit Nugget.

Fallbacks, de build blokkeert nooit op een ontbrekend asset:
- sprites: placeholder (afgeronde vorm in zwart, oranje en wit, oren, staart)
- items: simpele low-poly vormen in code
- texturen: procedureel (strepen, planken, bakstenen, ruis)
- achtergronden: Kit Nugget achtergronden, anders kleurverloop per zone
- geluid: WebAudio synth

## Woordjes

`visuals/` bevat een foto van de woordenlijst van school. Neem de woorden letterlijk over zoals ze op de foto staan (spelling van school, ook lidwoorden als die er staan, geen eigen correcties). Staan er meerdere lijsten of thema's op, maak dan meerdere thema's. Twijfel je over een woord (handschrift, onscherp), zet het er toch in en noem het in het eindrapport.

`src/content/words.json`:
```json
{ "themes": [ { "id": "familie", "title": "Familie", "words": [ { "id": "mother", "nl": "moeder", "en": "mother", "image": null } ] } ] }
```
Staat er geen familie-thema op de foto, voeg dan dit basisthema toe: mother, father, sister, brother, grandma, grandpa, baby, family, aunt, uncle, cousin, parents. Import in instellingen: tekstveld met `nl;en` per regel, voegt toe aan het gekozen thema of maakt een nieuw thema.

Plaatje per woord is optioneel: bestaat `public/words/<id>.webp`, dan tonen, anders niet. Geen plaatjes genereren.

## Twee speelrichtingen

1. **Nederlands naar Engels** (standaard): Nederlands woord groot in beeld. Drie knoppen met Engelse woorden. Tikken = antwoorden, het Engelse woord wordt uitgesproken.
2. **Engels naar Nederlands**: Engels woord groot in beeld en wordt direct uitgesproken, met een luidsprekerknop om opnieuw te horen. Drie knoppen met Nederlandse woorden.

Beide multiple choice, 1 goed en 2 afleiders uit hetzelfde thema. Afleiders bij voorkeur met een andere beginletter dan het goede antwoord zolang de woordstatus `nieuw` of `oefenen` is, daarna mag het lijken. Knoppen minimaal 72 px hoog, volgorde willekeurig.

Keuze op het startscherm met een grote schakelaar boven Speel ("Nederlands → Engels" / "Engels → Nederlands"), onthouden. Ook in instellingen.

Uitspraak: `SpeechSynthesis`, voorkeur stem `en-GB`, anders elke `en-*`, rate 0.85. Stemmen laden async (`voiceschanged`). Eerste `speak()` binnen een tik-handler (iOS). Nederlandse woorden worden niet uitgesproken.

## Engine

Een item is een woord in een richting: `mother:nl-en` en `mother:en-nl` zijn aparte items met een gedeelde `pairKey` (`mother`), net als 7x8 en 8x7 bij Kit Nugget. Status van de een beinvloedt de ander licht.

Per item: `seen`, `correct`, `wrong`, `rtEma` (alpha 0.4, alleen goede antwoorden), `streakFast`, `fastDays`, `lastSeen`, `status`.

Status:
- `nieuw`: seen = 0
- `oefenen`: laatste fout, of rtEma > 6 sec
- `snel`: rtEma tussen 4 en 6 sec, laatste 2 goed. Snel = goed binnen 4 sec
- `geautomatiseerd`: streakFast >= 3 en fastDays.size >= 2
- Fout zet altijd terug naar `oefenen`

Tijd wordt stil gemeten (van tonen tot tik). Nooit zichtbaar, nooit een timer, geen muisje.

Woordkiezer per beurt:
1. Fout woord in de herhaalrij met wachttijd 0: dat woord (komt terug binnen 3 beurten).
2. Leerkaart die terug moet komen (na 2 en 6 beurten): die.
3. Anders 70% `nieuw`/`oefenen` (gewogen op hoogste rtEma en meeste fouten), 30% `snel`/`geautomatiseerd` (gewogen op langst niet gezien).
4. Max 3 nieuwe woorden per ronde.
5. Vangnet: minder dan 75% goed over de laatste 8 beurten, dan alleen bekende woorden tot het weer boven 75% zit.
6. Nooit hetzelfde woord (pairKey) twee keer direct achter elkaar.

Leerkaart voor een nieuw woord: NL en EN samen groot in beeld, Engels wordt voorgelezen, een grote knop met het goede woord om aan te tikken. Geen sprong, wel Katja `happy`. Daarna komt het woord als gewone vraag terug na 2 en na 6 beurten.

Fout: Katja `surprised`, het goede woord licht op (zacht geel, geen rood) en wordt uitgesproken, Wyne tikt het nog een keer. Telt niet als sprong. Kort, geen overlay.

## Spelregels (Wyne)

- Een ronde = 30 goede beurten. Teller "sprongen deze ronde" 0 tot 30, groot in beeld. Verkeerd = geen sprong, teller loopt niet.
- Elke goede beurt is een sprong. Meestal omhoog langs dezelfde muur. Om de 3 tot 5 sprongen (random) een oversprong naar de muur aan de overkant: grotere boog, meer sterretjes, sprite spiegelen.
- Elke 5 sprongen ligt een item op een richel: 5 cape, 10 speelgoedmuis, 15 kroon, 20 verjaardagshoed, 25 strikje, 30 finale. Katja pakt het en doet het op of om. Ze begint elke ronde zonder items en houdt ze aan tot het eind van de ronde.
- Finale: de 30e sprong gaat naar een richel boven in het midden.
  - 1e ronde van de dag: feestelijke landing met sterretjes, tekst "Nog 1 ronde voor de confettikat!"
  - 2e ronde van de dag: Katja wordt de confettikat: pose `confetti`, regenboogsterretjes en confetti (particles in code, alle regenboogkleuren), confetti-fanfare, miauw. Daarna springt ze vrolijk van de richel naar beneden uit beeld met een blij glij-geluid (nooit als vallen gebracht, geen schrik). Tekst: "Katja is moe en tevreden. Morgen weer!"
  - Na de 2e ronde mag Wyne doorspelen. Een 3e of latere ronde eindigt ook als confettikat.
- Dagdoel: 2 rondes, als pootafdrukken op het startscherm.
- Eindscherm per ronde: 30 sprongen, tijd van de ronde, ronderecord (snelste 30), en de 3 woorden die nog aandacht nodig hebben (NL en EN, tikbaar voor uitspraak).

### Hoogte en zones

Hoogte is cumulatief in sprongen, Katja gaat verder waar ze was. Volgende ronde begint op de hoogte waar de vorige eindigde.

| Zone | Van | Tot | Muren |
|---|---|---|---|
| woonkamer | 0 | 60 | behang |
| zolder | 60 | 180 | houten planken |
| dak | 180 | 360 | bakstenen schoorstenen |
| wolken | 360 | 600 | wolkenzuilen |
| ruimte | 600 | oneindig | metalen ruimtestation-pilaren |

Overgang: crossfade van achtergrond en muurtextuur over 5 sprongen.

## Scene (2.5D)

Stijl: `poster` en `sheet` uit visuals (chunky low-poly 3D toy, warm licht, zachte vormen).

- Twee verticale 3D-muren links en rechts (elk ca. 18% van de schermbreedte), met textuur per zone, oneindig door segmenten te recyclen. Daartussen open ruimte met de achtergrond (parallax 0.3).
- Richels: kleine afgeronde 3D-plankjes aan de muur, alleen waar items liggen en de finale-richel in het midden bovenin (vrijstaand zwevend plateau, of een brug tussen de muren).
- Camera: perspectief, volgt Katja omhoog met lichte vertraging.
- Katja: sprite op een plane. Hang-poses: de `wallContact`-kolom precies tegen het muuroppervlak. Aan de linkermuur zoals getekend, aan de rechtermuur gespiegeld.
- Items als aparte sprite-lagen op de ankers uit `sprites.json`, meebewegend met pose en spiegeling. Laagvolgorde: cape achter Katja, dan Katja, strikje, speelgoedmuis op de rug, kroon, verjaardagshoed bovenop de kroon (een beetje scheef, grappig mag).
- Beweging in code: squash en stretch, boogsprong, lichte idle-wiebel, sterretjes bij elke sprong, meer bij oversprong.
- Poses: `hang` rust, `jump` tijdens sprong, `surprised` bij fout, `happy` bij snel goed en item pakken, `confetti` finale 2e ronde, `sleep`/`wake`/`beg` startscherm.
- 60 fps op iPhone. Pixel ratio cappen op 2.

## UI

- Staand, mobiel eerst. Scene boven 55%, woord plus drie knoppen onder 45%.
- Startscherm: achtergrond `bg-title`, Katja (`beg`, met de items die in Verzameling aan staan), pootafdrukken dagdoel, totale hoogte in sprongen, ronderecord, dagen gespeeld. Richtingschakelaar. Knoppen: Speel, Woordkaart, Verzameling, Instellingen.
- Slaap: laatste ronde meer dan 20 uur geleden, dan `sleep` met "Katja heeft geslapen. Tik om haar wakker te maken." Tik: `wake` (of `happy`) plus miauw, daarna `beg`.
- Woordkaart (ook ouderdashboard): raster van alle woorden van het thema, kleur per status grijs naar groen (per richting te wisselen). Tik: NL, EN, uitspraak, goed/fout, rtEma.
- Verzameling: plank met 5 items. Nog niet gevonden: silhouet met "bij sprong 5" enz. Gevonden items aan/uit te zetten, dat bepaalt wat Katja op het startscherm draagt.
- Instellingen: thema, richting, geluid, muziek, Katja-geluiden (aparte schakelaars), woorden importeren, voortgang wissen (met bevestiging).
- Geen zoom, geen scroll, geen tekstselectie tijdens het spel.

## Audio

- Synth-basis uit Kit Nugget: sprong (boing), oversprong (hogere boing plus glinstering), fout (zacht vragend "hm?"), item (glinstering), ronde klaar (deuntje). Extra: confetti-fanfare (kort, vrolijk) en een blij glij-geluid voor de sprong van de richel.
- Muziekloop 96 bpm uit Kit Nugget hergebruiken. Zachter (ducking) tijdens uitspraak van een woord.
- `purr` bij happy, `meow` bij finale en wakker worden.

## Lessen uit Kit Nugget (meteen goed doen)

- iOS audio: bij de eerste gebruikersactie `navigator.audioSession.type = 'playback'` zetten (als beschikbaar) en AudioContext resumen. Gesture-listeners breed (pointerdown, touchend, click).
- iOS standalone PWA: `100vh`/`innerHeight` is te kort (mist de statusbalk). Gebruik een CSS-variabele `--app-h = max(innerHeight, screen.height)` bij resize/orientationchange, en maak de achtergrondkleur van html en body gelijk aan de onderste panelkleur.
- Safe areas met `env(safe-area-inset-*)`.

## Storage

Key `rainbowkitten.v1`, een JSON-blob met `schemaVersion` en migratie. Profiel-klaar: `{ activeProfile: "wyne", profiles: { wyne: {...} } }`, nog geen profielkeuze in de UI.

## Tests (Vitest)

Statusovergangen, herhaalrij binnen 3 beurten, leerkaart terug na 2 en 6 beurten, max 3 nieuw per ronde, vangnet onder 75%, 70/30-verdeling over 1000 trekkingen (seeded RNG), geen directe herhaling op pairKey, afleiders uit hetzelfde thema en nooit gelijk aan het antwoord, sprongteller (fout telt niet), oversprong elke 3 tot 5, item-unlocks op 5/10/15/20/25, finale-conditie (30 sprongen, confetti alleen vanaf 2e ronde van de dag, dagwissel om middernacht lokale tijd), cumulatieve hoogte en zonegrenzen, import `nl;en`.

## Fases

Alles in een run, in deze volgorde. Commit per werkend onderdeel. Na elke fase: tests groen en `npm run build` slaagt.

1. Scaffold, engine gekopieerd en omgebouwd naar woorden, tests
2. Woordenlijst van de foto naar `words.json`
3. Asset-pipeline, `npm run assets`, debug-plaatjes bekijken en bijstellen
4. Game-loop, drie knoppen, leerkaart, uitspraak, storage
5. Scene: muren, camera, Katja, sprongen en oversprongen, item-lagen
6. Items, finale en confettikat, dagdoel, zones, audio
7. Startscherm, woordkaart, verzameling, instellingen
8. PWA: manifest, iconen, offline, iOS-fixes
9. Controle: als er een headless browser is, screenshots op 390x844 en 402x874, en een volledige ronde automatisch doorspelen

Rapporteer aan het eind: wat af is, welke assets op fallback draaien, de volledige overgenomen woordenlijst (zodat Roeland die kan nalopen) met twijfelgevallen, en hoe te deployen.

## Niet nu

Luister-en-kies modus, typmodus, profielen, tweespeler, zinnen, grammatica, gegenereerde plaatjes per woord, accounts, sync, analytics.
