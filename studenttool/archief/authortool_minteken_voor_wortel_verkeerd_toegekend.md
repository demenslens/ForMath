# ⚠️ ACHTERHAALD — NIET OP AFGAAN (rode haring)
#
# De wortel-teken-diagnose hieronder is FOUT. B1 = -1/8 is prima voor de matcher;
# de echte oorzaak was breuk-notatie-mismatch (matcher-pad v156, waarde-pad v157).
# Zie: latexToMathJs_shorthand_breuk_kapot.md en INVENTARISATIE_breuk_notatie_paden.md (§5.3).
# De authortool-wijzigingen op deze foute diagnose zijn teruggedraaid.
# ---
# Authortool: minteken vóór een afgetrokken wortel belandt in de wortel-bewerking

Overdracht chat → Claude Code, 2026-06-14. Dit is een AUTHORTOOL-bug (opgave-
generatie), NIET de studenttool/matcher. Aparte codebase-helft.

## Symptoom (studenttool, maar oorzaak in authortool)

Bij opgave 511_023: de leerling rekent correct `√(1/64) = 1/8` en krijgt de
algemene foutmelding **"niet herleidbare bewerking"** — terwijl het antwoord goed is.

## Diagnose: de opgave definieert de wortel met het VERKEERDE teken

Expressie: `((7/6-3/4)/(2-sqrt(1/64)))×3^2-3/4` — let op `2 − √(1/64)`.

Mathblock B1 in de JSON:
```
B1 (step 1): symbool="-(√)"  beschrijving=worteltrekken  index=2  in=[1/64]  out=-1/8
```
De opgave zegt dus `√(1/64) = -1/8`. FOUT: een vierkantswortel is per conventie
positief → `√(1/64) = +1/8`.

Duo stap 1 bevestigt de constructie:
```
input:   …(2 − (√(1/64)))…
hoog B1: …(2 + −1/8)…
```
De `−` van de aftrekking (`2 − …`) is naar de wortel-UITKOMST geschoven: de
worteltrekking levert `−1/8` en de aftrekking is een optelling van een negatief
getal geworden. Vervolgblok B2 (`+ in=[2, B1] out=15/8`) rekent consistent door:
2 + (−1/8) = 15/8. De hele keten is intern consistent, maar gebouwd op een
wiskundig foute wortel.

## Waarom de matcher dan (terecht) "niet herleidbaar" zegt

De leerling voert `√(1/64) = 1/8` in (correct, positief). De matcher vergelijkt
met de verwachte B1-output `−1/8`, ziet `1/8 ≠ −1/8`, en kan dat verschil niet als
geldige worteltrekking classificeren → "niet herleidbare bewerking". De MATCHER
WERKT CORRECT; de waarheid waartegen hij toetst is fout. Niet de matcher fixen.

## Oorzaak (structureel, authortool)

Bij het genereren van een term `a − √(x)` wordt het minteken van de AFTREKKING
toegekend aan de WORTELTREKKING-bewerking (symbool `-(√)`, output negatief) i.p.v.:
- de worteltrekking positief te houden (`√(x) = +waarde`), en
- de min bij de aftrekking te laten (`a − waarde`).

Dit treft ELKE gegenereerde opgave met een afgetrokken wortel (`… − √(…)`), niet
alleen 511_023. Mogelijk ook andere afgetrokken functies/termen — checken of
hetzelfde patroon optreedt bij `a − (iets dat als eigen bewerking wordt geparset)`.

## Wat Code moet doen (authortool)

1. **Lokaliseer de parser/bewerking-opbouw** waar `a − √(x)` wordt omgezet naar
   mathblocks. Zoek waar het symbool `-(√)` (of analoog) ontstaat en waar de
   negatieve output wordt toegekend.
2. **Fix**: de worteltrekking-bewerking moet de POSITIEVE wortelwaarde opleveren
   (`√(1/64) = 1/8`), en het minteken hoort bij de omvattende aftrekking
   (`2 − 1/8`), niet bij de wortel. Pas de mathblock-generatie zo aan dat:
   - B1: `symbool="√"`, `out=1/8` (positief),
   - de aftrekking `2 − B1` als aparte (aftrek-)bewerking, of de min in de
     structuur van het omvattende blok.
3. **Regenereer/repareer** 511_023 (en andere opgaven met afgetrokken wortels) na
   de fix, zodat de JSON de juiste tekens heeft.
4. **Generaliseer-check**: geldt hetzelfde mis-toekennen voor `a − (b)^n`,
   `a − |b|`, of andere afgetrokken samengestelde termen? Verifieer.

## Verificatie

1. Genereer/repareer 511_023 → B1 moet `√(1/64) = 1/8` zijn (positief), B2 de
   aftrekking `2 − 1/8 = 15/8`.
2. In de studenttool: leerling voert `√(1/64) = 1/8` in → wordt GOEDGEKEURD (geen
   "niet herleidbare bewerking" meer).
3. Numerieke eindwaarde van de hele opgave moet gelijk blijven (de wiskunde
   verandert niet, alleen de teken-toekenning): controleer dat de slotuitkomst
   onveranderd is.
4. Andere opgaven met afgetrokken wortels: zelfde check.

## Relatie tot het geparkeerde wortel-spoor

Dit is een NIEUW, concreet wortel-probleem, ANDER dan het geparkeerde
"kan-geen-wortel-fout-produceren" (511_027). Hier wordt juist een CORRECTE
wortel-stap afgekeurd door een foute opgavedefinitie. Beide wijzen op zwakke
wortel-afhandeling, maar dit is direct fixbaar in de authortool-generatie en
hoeft niet te wachten op de bredere wortel-sessie.

Niet committen tot Henk bevestigt (en de eindwaarde-check klopt).
