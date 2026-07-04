# Liniatuur laten meegroeien met de rijhoogte (cosmetisch, probeersel)

Overdracht chat → Claude Code, 2026-06-14. Aparte kwestie van de box-plaatsing.
Status: **probeersel** — Henk weet nog niet of het bevalt. Achter een eenvoudig
terug te draaien wijziging zetten; **niets committen** tot Henk het in de browser
heeft gezien.

## Symptoom (door Henk waargenomen)

Naarmate er meer regels op het werkblad komen, verschuiven de expressies t.o.v. de
blauwe liniatuur (schrift-lijntjes). Hoe meer (hoge) regels, hoe groter de
scheefstand. Zuiver cosmetisch — het schrift loopt correct door.

## Diagnose (gemeten in de browser, niet gegokt)

Er zijn **twee parallelle lagen met verschillende hoogte-bron**:

1. **Liniatuur-laag** — losse `div.batch-item`-rijen, elk **vast 47px** hoog, met
   `border-bottom: 1px rgb(220,215,198)`. Dít tekent de lijntjes. Lijnen liggen dus
   op vaste 47, 94, 141, … px.
2. **Inhoud-laag** — de mathfield-rij-containers, die **variabel** meegroeien met de
   expressie-hoogte. Gemeten: rij = mathfield + 8px (4px padding boven/onder),
   consistent over de hele pagina:
   - lage breuk: mathfield 43–44 → rij 47–52
   - samengestelde expressie: mathfield 51 → rij 59; mathfield 54 → rij 62;
     mathfield 61 → rij 69; mathfield 72 → rij **80**

Zolang elke expressie ~47px past, lopen de lagen gelijk. Zodra er een hoge
expressie tussen zit, schuift de inhoud-laag eronder weg t.o.v. de vaste
47px-liniatuur, cumulatief. De twee lagen delen geen hoogte-bron → lopen per
definitie uiteen. Dat is precies het symptoom.

Gemeten feiten (console):
- regelstappen zichtbare (lage) set: constant 47–48px.
- gradient-achtergrond op de pagina: **1**, en dat is de *mustard actieve-regel-
  highlight* (`linear-gradient(90deg, rgba(174,122,21,0.07) … )`, element
  `div.rl.active`) — NIET de liniatuur. Niet aanzien voor de lijntjes.
- liniatuur-bron bevestigd: `div.batch-item`, h=47, border-bottom 1px #dcd7c6.

## Belangrijk: box-plaatsing NIET in gevaar

De pinpoint-foutbox meet op `math-field.getBoundingClientRect()`, en de mathfields
staan correct binnen hun (meegroeiende) rij-containers — geen overlap, overal +8px.
De liniatuur-drift raakt de box-meting dus niet. Dit is puur de decoratieve lijn-
laag die niet meer achter het schrift ligt.

## Gewenste fix (aanpak)

Laat de onderlijn **per inhoud-rij** meelopen i.p.v. een vaste-hoogte liniatuur-
stapel:

1. Teken de `border-bottom` (1px, kleur #dcd7c6 / `rgb(220,215,198)` — dezelfde als
   nu) op de **mathfield-rij-container** zelf. Die rekt al correct mee met de
   expressie-hoogte, dus de lijn ligt dan altijd onder de regel, ongeacht hoogte.
2. Verwijder/deactiveer de losse vaste-47px `div.batch-item`-liniatuur-laag (of
   zet z'n `border-bottom` uit), zodat er geen dubbele/uit-de-pas lijnen meer zijn.
3. Lege regels onder het schrift (de "nog niet ingevulde" lijntjes onderaan het
   blad) horen visueel te blijven. Als die uit de `batch-item`-laag kwamen: zorg dat
   er ná de laatste inhoud-rij nog een paar lege liniatuur-regels blijven staan,
   anders verdwijnt de schrift-look onderaan. (Zie risico 3.)

## Risico's / niet kapotmaken

1. **Actieve-regel-highlight** (`div.rl.active`, de mustard gradient-balk): die mag
   niet sneuvelen of verspringen door de herstructurering. Apart van de lijntjes
   houden.
2. **Box-meting**: de mathfield-`getBoundingClientRect` mag niet veranderen door de
   lay-out-wijziging (geen extra margin/transform op de mathfield zelf die de
   gemeten top/height verschuift). Controleer na de wijziging dat een pinpoint-box
   nog strak zit (bv. 511_022 kale teller `13/12`, die we net geverifieerd hebben).
3. **Lege onder-regels**: als de `batch-item`-laag óók de lege lijntjes onder het
   laatste antwoord tekent, mogen die niet allemaal verdwijnen — anders is het geen
   "schrift" meer onderaan. Behoud een aantal lege liniatuur-regels.
4. **Linker rode kantlijn** + de ronde "gaatjes": staan die los van `batch-item`?
   Zo niet, niet meeslopen bij het verwijderen.

## Verificatie (browser, privévenster, cache-discipline)

1. `?v=` ophogen voor de geraakte CSS/JS; `wc -c` + `curl`, hard reload.
2. Vul een opgave met **gemengde** regelhoogtes in (lage breuken + minstens één hoge
   samengestelde expressie / wortel). Lijn moet onder ELKE regel liggen, ook na de
   hoge.
3. Meet opnieuw: rij-stappen moeten nu variabel zijn (47–80) en de lijn moet met de
   rij-onderkant samenvallen — geen cumulatieve drift meer.
4. Pinpoint-box 511_022 kale teller `13/12`: nog steeds strak (box-meting niet
   verschoven door de lay-out-wijziging).
5. Actieve-regel-highlight: nog op de juiste regel.
6. Lege onder-regels: nog zichtbaar.

## Terugdraaibaarheid

Zet de wijziging zó dat hij in één stap terug kan (bv. een CSS-class-toggle of een
duidelijk afgebakend blok), want Henk weet nog niet of het bevalt. Bij twijfel:
liever twee kleine commits klaarzetten (lijn-op-rij aan / batch-item-lijn uit) dan
één grote onomkeerbare herstructurering.

## Context / vindplaatsen

- Liniatuur-rij: `div.batch-item`, vaste h=47, border-bottom 1px #dcd7c6.
- Actieve highlight: `div.rl.active`, mustard 90deg-gradient — NIET aankomen.
- Mathfield-rij-container: `math-field.closest('div')`, h = mathfield + 8px.
- Mapstructuur: `~/Desktop/formath/studenttool/werkblad/`. Server vanuit
  `studenttool/`: `python3 -m http.server 8000`, open `/werkblad/werkblad.html`.
