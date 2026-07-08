# Route B checkStep-crash — probleem & oplossing

**Datum:** 2026-07-08 · **Opgelost door:** Fable 5 (diagnose-review + implementatie),
geïntegreerd + browser-geverifieerd in de hoofdsessie · **Commit:** `0290ac1`

## Het symptoom

Bij een grote opgave (511-004) gebeurde dit: de leerling voerde een deel-
bewerking uit (bv. **C5**: `1 − 1/4 → 3/4`), kreeg een **groen vinkje**, maar er
werd **niets vastgelegd**. `window.__duoNow()` toonde `resolvedBlocks: []`,
`currentTree` bleef op de oude expressie staan, en de opvolgende bewerking
(**C6** = `3/4 : 3/8`) kwam daardoor **nooit vrij** — er verscheen geen C6-kader
en de DUO-integriteit werkte niet.

Kortom: **vinkje zonder resolutie.** Dagenlang leek het een verankerings- of
hint-probleem, maar dat was het niet.

## De oorzaak (root cause)

Zichtbaar gemaakt met `window.FORMATH_DEBUG = true`:

```
[pinpointMatcher] checkStep wierp: "undefined is not an object (evaluating 'a.args.length')"
[doLF] pinResult: type=2 errors=0 resolved=0
```

`checkStep` (de matcher) **crashte**. Daardoor gaf `pinpointFromMatcher` `null`
terug, viel `doLF` terug op de oude tekst-gebaseerde pattern-pinpoint (die op deze
reuze-expressie niets vond), en zette de **waarde-check** alsnog het vinkje. Het
vinkje betekende dus "waarde klopt", niet "stap herkend".

**Waarom de crash:** de matcher werkt intern met zijn eigen boomvorm
`{op, args, raw}` (uit `parseDuo`). Route B (die ik toevoegde voor de DUO-
integriteit) gaf `checkStep` echter de **levende `currentTree` en de afgeleide
`outputTree`'s mee in MathJSON-vorm** (`["Op", arg, arg]`). MathJSON-arrays hebben
geen `.op`/`.args`, dus `locateBoundary`/`diffPath`/`treesEqual` liepen stuk op
`a.args.length`. Gevolg: **route B's resolutie was stil kapot vanaf het moment dat
hij `inputTree`/`outputTree` ging meegeven** — bij simpele gevallen ving de
fallback het op, bij deze grote expressie faalde ook die.

## De oplossing

Een converter **`mathjsonNaarMatcher(node)`** (werkblad.js) die MathJSON **exact**
naar de `parseDuo`-vorm omzet, toegepast op `inputTree` en op elke `outputTree`
vóór ze aan `checkStep` gaan:

| MathJSON | matcher-vorm |
|---|---|
| getal `n` | `{op:'num', raw:n}` — negatief → `Negate(num)` |
| `["Rational",n,d]` | `Frac` (breuk-wáárde) — negatief → `Negate(Frac)`; `d=1` → kaal getal |
| `["Divide",a,b]` | `Divide` (deling-operatie) |
| `["Add"/"Multiply",…]` | afgevlakt zoals `flatten()`, **mét `grp`-groepsmarkering** |
| `["Simplify"/"MixedNumber",x]` | transparant naar `x` |
| `["Root"/"NthRoot",r,i]` | `NthRoot(r,i)` |
| onbekend | `opaque`-blad (geen crash) |

**De scherpe vondst van Fable:** de `grp`-groepsmarkering. Een geneste
`Add`-in-`Add` is in de DUO-tekst een gehaakte groep; `parseDuo` geeft die leden
een gedeeld group-id (non-enumerable `grp`, zoals `setGrp` in de matcher). Zonder
die markering vindt `findGroupInTree` een geneste manifold (zoals **A5** in
511-004) niet en ankert die **stil verkeerd** op de hele teller — precies de
"net-niet-gelijke vorm faalt geruisloos"-valkuil.

`matcher.browser.js` is **nul regels** gewijzigd — de statische matcher-tak en de
veld-parse blijven per constructie intact.

## Verificatie

**Offline** (Node-harnas op de échte matcher, door Fable):
- Equivalentie: `parseDuo(step.input_expressie)` ≡ `mathjsonNaarMatcher(AST)` ✓
- Boundary-pariteit statisch ↔ route B (A1/B1/A5/B2/C5) ✓
- Rauwe MathJSON crasht (reproductie); geconverteerd: **C5 = CANONIEK** ✓
- **C6 = CANONIEK ná C5-inklap** (het eigenlijke DUO-integriteitsdoel) ✓
- Bestaande regressies: `test_harnas` 30 PASS, `regress_grp` 6 PASS

**Browser:** C5 → `resolvedBlocks: ["C5"]`, C6 komt vrij en wordt correct
omkaderd als `(3/4) : 3/8`.

## Plaats in het geheel

Dit was de **laatste schakel** in het traject: DUO-integriteit (route B) +
robuuste hint/fout-verankering (LCS + exclusieve composite-erving + veld-parse) +
deze matcher-formaatfix. Samen vormen ze het betrouwbare fundament voor de
volgende mijlpaal: de **error-pinpointing**. Zie ook
[verankering_review_fable5.md](verankering_review_fable5.md).
