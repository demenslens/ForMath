# Hint-lokalisatie: twee anomalieën (geparkeerd, 2026-07-04)

Gevonden bij het breder testen van de gecombineerde hoog+laag-hints (v168). Beide
zijn PRÉ-EXISTENT — niet veroorzaakt door de combinatie; de individuele
kader-verankering is ongewijzigd. Los spoor, apart van de LF-keten.

## 1. 520-001 — genest mathblock knipt het kader af (studenttool / genLatexTokens)

Expressie bevat `(1/2 : √1)`. In de AST:
- `A1` = de **deling** `1/2 : √1` (node_map operation-pad = de `Divide`-knoop,
  output −1/2).
- `A0` = de `√1` erbinnen, een **eigen** mathblock (`√`, output 1), pad = de
  `Sqrt`-knoop ín A1.

`genLatexTokens` tagt elke token met het DIEPSTE omvattende mathblock (`mbForPath`
loopt omhoog). De `√1`-tokens vallen dus onder A0, waardoor A1's kader alleen
`1/2 :` dekt en niet de hele deling. Visueel lijkt het "om 1/2" te staan.

**Kern:** een mathblock-kader dat een genest sub-mathblock omvat, wordt door de
token-tagging opgeknipt. Mogelijk gewenst gedrag (A0 en A1 zijn aparte stappen),
mogelijk te verbeteren (A1-kader zou de hele deling incl. de √1-plek kunnen dekken).

## 2. 511-027 — vermoedelijke AST↔LaTeX-mismatch (authortool / data)

De editor **rendert** `³√(1 − 1/2)` (derdemachtswortel van `1−1/2`), maar de **AST**
is `Add(Root(1,3), −1/2)` = `(³√1) − 1/2` = 1 − 1/2 = 1/2 (dat is A1, een `+`-
optelling; A0 = `³√1`, output 1).

`³√(1/2)` ≠ `1 − 1/2` → de getoonde LaTeX en de AST zijn wiskundig verschillend.
Het groene A1-kader (`³√1 − 1/2`) valt door die afwijkende rendering op `1−1/2`.

**Kern:** waarschijnlijk een authortool/opgave-data-kwestie (de begin-LaTeX matcht
de AST-structuur niet), niet de studenttool-hint. Eerst verifiëren welke van de
twee (LaTeX of AST) de bedoelde opgave is.

## Verificatie-ingang
- `JSON.stringify(__toonHintBeide())` op elke opgave toont `teTonen` + `perBlock`.
- `__dumpCurrentTree()` / de opgave-`metadata.expressie.ast` voor de boomvorm.
