# Browserprobe §4 — wat MathLive 0.110 uitstuurt per breuk-type (HARD bewijs)

Aanvulling op `INVENTARISATIE_breuk_notatie_paden.md` §4. Vervangt het "vermoedelijk"
door gemeten feiten. Probe in privévenster, `mf.getValue('latex')` per ingetypte breuk.

## Meetresultaten

| Ingetypt | getValue('latex') | Regel |
|----------|-------------------|-------|
| 1/8   | `\frac18`                                        | beide args 1 token → shorthand |
| 12/15 | `\frac{12}{15}`                                  | beide meercijferig → accolades |
| 1/15  | `\frac{1}{15}`                                   | GEMENGD: noemer >1 teken → ALLES accolades (ook de 1-cijfer teller) |
| genest| `\frac{\left(\frac12\right)}{\left(\frac34\right)}` | buitenste gehaakt; binnenste shorthand + `\left(\right)` |

## De regel (hard)

**MathLive gebruikt shorthand `\fracAB` (zonder accolades) DAN EN SLECHTS DAN ALS
zowel teller als noemer uit precies één token (één cijfer) bestaat. Zodra één van
beide meer dan één teken heeft → accolades `\frac{..}{..}` voor BEIDE.**

Shorthand en accolades komen DOOR ELKAAR voor binnen één expressie, per nestingsniveau
(zie genest geval: buitenste gehaakt, binnenste shorthand). Daarom moet normalisatie
RECURSIEF zijn — niet op het buitenste niveau stoppen (precies waarom v157 nodig was).

## Twee normalisatie-zorgen voor het migratieplan (normalizeLatex)

1. **Shorthand → accolades, recursief.** Regex die `\frac` gevolgd door twee losse
   tokens (geen `{`) omzet naar `\frac{x}{y}`, recursief toegepast tot alle shorthand
   weg is. Dit is de KERN; de regel is eenvoudig en voorspelbaar (één-teken-test).
2. **`\left(...\right)` rond breuk-argumenten afpellen.** Geneste breuken komen met
   delimiters: `\frac{\left(\frac12\right)}{\left(\frac34\right)}`. Die haakjes moeten
   correct verwerkt worden, anders Frac-vs-Divide-verwarring downstream
   (parseDuoTextTyped leest `(d)/(d)` als Divide — zie inventarisatie §3).

## Status van de notatie-matrix

Matrix-rij "MathLive" (inventarisatie §4) is hiermee HARD. Resterend vóór de
canonieke-vorm-migratie-beslissing: het BOX-RISICO — bevestigen dat de
`\frac{...}`-structuuroffsets die de pinpoint-box leest (mathblockBounds) NIET wijzigen
door normalizeLatex. Dat is een code-check (geen browserprobe): normalizeLatex draait
op het MATCHER/WAARDE-pad, niet op de gerenderde latex die MathLive toont en die de box
uitleest — te bevestigen door Code.
