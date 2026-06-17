# Ontwerp: PVN-blok + LC-alias voor het optellen/aftrekken van twee breuken

Ontwerp (GEEN bouwopdracht-tot-Henk-akkoord), 2026-06-15. Raakt TWEE codebases:
authortool (JSON-generatie, laag 1) en studenttool/matcher (fijnmazige validatie +
teller/noemer-boxing, laag 2). Scope: optellen/aftrekken van TWEE breuken, geen ketens.

## Aanleiding & begrippen

Bij optellen/aftrekken van twee breuken moeten de noemers gelijk worden gemaakt.
Twee methoden:
- **KGV** (kleinste gemene veelvoud) — staat al in de JSON (`gelijknamig_maken.kgv`).
- **PVN** (Product Van de Noemers) — noemers vermenigvuldigen, tellers compenseren.
  NIEUW expliciet te maken. Dit is de methode die de leerling nu leert.

**LC (Lokaal Canoniek)** = de uiteindelijke uitkomst van een mathblock. ALIAS voor
het bestaande `output`-veld. Geldt voor ELK mathblock, niet alleen optellingen.
(Alias = `output` blijft bestaan; `LC` verwijst ernaar / wordt als extra naam
toegevoegd. NIET hernoemen — dat zou alles raken wat `output` leest.)

## IJkvoorbeeld — 511_022, mathblock A1 = `25/4 - 31/8`

Bestaand in de JSON (KGV-methode):
```
"output": "76/32",
"gelijknamig_maken": {
  "nodig": true, "kgv": 8, "noemers": [4,8],
  "breuken_origineel": ["25/4","-31/8"],
  "breuken_gelijknamig": ["50/8","-31/8"],   ← KGV-variant
  "efficientie": {...}
}
```

PVN-berekening (noemers ×, tellers compenseren):
- gemeenschappelijke noemer = 4 × 8 = 32
- 25/4 → 200/32 ; -31/8 → -124/32
- PVN-tussenvorm = `200/32 - 124/32` ; uitkomst (LC) = `76/32`
- KGV (8) ≠ PVN (32) → vlag.

## Voorgestelde JSON-uitbreiding (laag 1, authortool)

Voeg een PVN-blok toe NAAST het bestaande KGV-blok (KGV niet weggooien — waardevol
voor latere "slimme methode"-feedback):
```
"gelijknamig_maken": {
  "nodig": true,
  "kgv": 8,
  "noemers": [4,8],
  "breuken_origineel": ["25/4","-31/8"],
  "breuken_gelijknamig": ["50/8","-31/8"],        // bestaand = KGV
  "pvn": {                                          // NIEUW
    "noemer": 32,
    "breuken_gelijknamig": ["200/32","-124/32"],
    "tellers": [200,-124]
  },
  "kgv_gelijk_aan_pvn": false,                      // NIEUW (hier false: 8≠32)
  "efficientie": {... bestaand ...}
}
```
- `LC` als alias voor `output` (toevoegen, niet vervangen).
- Bij `kgv_gelijk_aan_pvn: true` zijn KGV- en PVN-vorm identiek (geen apart verschil
  te tonen) — vlag laat de studenttool beslissen of het verschil relevant is.

## DUO-verzameling (laag 1) — de getoonde tussenstap

Nu geeft de duo-output van A1 alleen de uitkomst:
```
"mathblock":"A1", "output_expressie":"((76/32:(29/6-11/3))×(7^2:3^3))"
```
Toevoegen: de PVN-tussenvorm als aparte (getoonde) stap, vóór de reductie:
```
"mathblock":"A1",
"pvn_expressie":   "(((200/32-124/32):(29/6-11/3))×(7^2:3^3))",   // gelijknamig, nog niet opgeteld
"output_expressie":"((76/32:(29/6-11/3))×(7^2:3^3))"              // = LC (reductie), bestaand
```
(Exacte veldnaam `pvn_expressie` t.b.v. discussie — Code/Henk mogen bijstellen.)

## Studenttool/matcher (laag 2) — fijnmazige validatie + boxing

DOEL: een fout in het gelijknamig maken kunnen aanwijzen op TELLER- en/of
NOEMER-niveau, met bijpassende feedback. Past op de box-infrastructuur: een breuk
bestaat al uit losse teller- en noemer-cijfer-offsets (zie
`REFERENTIE_box_plaatsing.md` §2), dus een teller of noemer apart omkaderen is
technisch mogelijk zodra de matcher de fout daar lokaliseert.

Wat laag 2 nodig heeft van laag 1: de PVN-tussenvorm (verwachte gelijknamige
breuken) + de losse tellers/noemers, zodat de matcher de leerling-invoer per
teller/noemer kan vergelijken i.p.v. alleen de eindwaarde.

Validatie-niveaus (grof → fijn):
1. eindwaarde klopt? (bestaand)
2. gelijknamige noemer klopt (= PVN-noemer, of KGV indien leerling die koos)?
3. per breuk: teller correct gecompenseerd?
Feedback wordt fijnmaziger naarmate je dieper kunt lokaliseren. Zonder teller/noemer-
boxing blijft feedback oppervlakkig (alleen "klopt niet") — vandaar de koppeling.

## Volgorde-advies (belangrijk)

1. EERST: de lopende normalizeLatex-migratie (fase 1, v158) natesten + committen.
   NIET op ongetest werk stapelen.
2. DAN laag 1 (authortool): JSON-uitbreiding + duo-tussenvorm, met A1 van 511_022 als
   ijk. Regenereer/repareer de testopgaven.
3. DAN laag 2 (studenttool): fijnmazige validatie + teller/noemer-boxing.
Laag 1 moet vóór laag 2 — zonder de verrijkte JSON kan de studenttool niet fijnmaziger
valideren.

## Open punten voor Henk vóór bouw
- Veldnamen definitief? (`pvn`, `pvn_expressie`, `kgv_gelijk_aan_pvn`, `LC`-alias)
- PVN altijd berekenen ook als `kgv_gelijk_aan_pvn=true` (consistentie) of weglaten?
- Aftrekken = optellen met negatieve teller (zoals `-31/8` hier) — bevestigen dat de
  PVN-regel daar identiek werkt (ja: -31/8 → -124/32).
