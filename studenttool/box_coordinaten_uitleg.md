# Uitleg: x, y, w, h, bottom, mb (de verankering-meting)

Bij het plaatsen van de grijze/fout-kaders meet de studenttool voor elk stukje
van de formule een **bounding box** (omhullende rechthoek) op het scherm. De
`[allOffsets]`-debugregels tonen die per "offset". Dit document legt uit wat de
getallen betekenen.

## De tekening (belangrijkste eerst)

Een bounding box is een rechthoek in **schermcoördinaten**. De oorsprong (0,0)
ligt **linksboven**; **x** loopt naar rechts, **y** loopt naar **beneden**.

```
        (0,0)  ──────────  x groter  ──────────►
          │
          │            x              x + w
          │            │                │
          │      y ──► ┌────────────────┐   ← BOVENkant van de box (= y)
          │            │                │
       y groter        │   het stukje   │   ▲
       (naar           │   formule      │   │  h  = hoogte
       beneden)        │                │   ▼
          │   bottom ► └────────────────┘   ← ONDERkant van de box (= y + h)
          ▼            │◄───── w ──────►│
                            (breedte)
```

| waarde | betekenis | let op |
|---|---|---|
| **x** | linkerrand van de box (px) | groter = meer naar rechts |
| **y** | **bovenkant** van de box (px) | y loopt naar BENEDEN, dus **kleinere y = hoger op het scherm** |
| **w** | breedte (px) | x + w = rechterrand |
| **h** | hoogte (px) | |
| **bottom** | onderkant = **y + h** (px) | de "vloer" van de box |
| **mb** | het mathblock-id (bv. `A1`, `B1`) waar dit stukje bij hoort, of `-` als het bij geen enkel mathblock hoort | |

**Kernpunt over y:** omdat y naar beneden groeit, is de **baseline** (de regel
waarop de cijfers "staan") ongeveer de **bottom** (`y + h`) van een cijfer-box.
Twee elementen staan op dezelfde regel als ze (ongeveer) dezelfde `bottom` hebben.
Een box die **hoger** reikt heeft een **kleinere y** (bovenkant hoger).

## Wat is een "offset"?

MathLive verdeelt de getoonde formule in kleine stukjes ("offsets"). Elke offset
heeft:
- een stukje **latex** (bijv. `"6"`, `"\sqrt{16}"`, `"\times"`),
- een **bounds** = `{x, y, w, h}` (de rechthoek op het scherm),
- en na koppeling een **mb**-label (welk mathblock).

Een kader om een mathblock = de omhullende rechthoek van alle offsets met dat
mb-label. (`span-x: 1003..1019` betekent: van x=1003 tot x=1019.)

## Voorbeeld: √16 (opgave 511-017)

Uit de meting (vereenvoudigd):

```
  offset            latex          x      w    mb
  ───────────────────────────────────────────────
  5   "1"                          1003    8    A1     ← radicand-cijfer
  6   "6"                          1011    8    A1     ← radicand-cijfer
  7   "\sqrt{16}"                  986     33   -      ← HELE wortel (√ + streep + 16)
```

Op het scherm:

```
        x=986        x=1003  x=1011  x=1019
          │            │       │       │
          │      ┌─────────────────────┐   ← overstreep (top van offset 7)
          ▼      │                     │
        ╲        │                     │
         ╲       │   1        6        │   ← de radicand-cijfers "16"
          ╲______│                     │
           (√-teken)                       (baseline = bottom van "1"/"6")

  offset 7  (\sqrt{16}):  x = 986 .. 1019   → bevat het √-teken ÉN de 16
  cijfers   (1, 6):       x = 1003 .. 1019  → ALLEEN de 16, niet het √-teken
```

**Waarom dit ertoe doet voor het kader:** het **√-teken zelf heeft geen eigen
cijfer-offset**. Alleen de radicand-cijfers (`1`, `6`) krijgen het label `A1`. Als
het kader alleen die cijfers omvat, loopt het van x=1003..1019 en **mist het het
wortelteken** (dat links op x≈986 begint).

Daarom neemt het kader de omvattende `\sqrt{16}`-offset (nr. 7) erbij: die reikt
naar links tot x=986 en dekt zo het wortelteken. De fijnafstelling gaat over:
- **links**: bij de `\sqrt`-offset beginnen (evt. een paar px naar binnen),
- **onderkant (baseline)**: op de cijferregel houden, zodat hij samenvalt met bv.
  de `3²` ernaast — dus dezelfde `bottom`,
- **hoogte/bovenkant**: hoe ver omhoog de box loopt (t/m de overstreep of t/m de
  superscript van een macht).

Dat is precies waar we nu naar de exacte `y`- en `bottom`-waarden kijken: om de
onderkant van het √-kader op dezelfde `bottom` te leggen als het `3²`-kader, en de
hoogte gelijk te maken.

## De twee meetregels: `[offsets]` en `[kader]`

Zet `window.__boxDebug = true` in de console en zet de kaders aan. Je krijgt dan
twee soorten regels:

- **`[offsets]`** — de **losse MathLive-elementen** (elk cijfer, elke structuur
  zoals `\sqrt{16}`) met hun ruwe bounds (`x, y, w, h, bot, mb`). Dat is de tabel
  hierboven: de **meting**.
- **`[kader] A1  x=… y=… w=… h=… bot=…  (diepte=…)`** — de **daadwerkelijk
  getékende grijze box** om mathblock `A1`: het **resultaat**.

**Het kader is niet gelijk aan de ruwe offset-span.** Het ontstaat zo:

```
kader  =  span van de mb-offsets             (omhullende rechthoek van de cijfers)
        + (voor een wortel) de \sqrt-offset   (om het wortelteken mee te nemen)
        + HINT_MARGE                          (vaste ademruimte rondom, px)
        + DEPTH_SIZE_CORR[diepte]             (empirische fudge per nesting-diepte)
```

- **`diepte`** = de nesting-diepte waaraan het kader hangt (0 = hoofdregel, hoger
  = dieper genest / kleiner). De fudge `DEPTH_SIZE_CORR` rekt de box per diepte een
  paar px op (breedte `dw`, hoogte `dh`). Twee kaders lijnen pas écht uit als ze
  **dezelfde diepte** hebben — anders krijgen ze een andere fudge. Zo kreeg het
  √-kader eerst diepte 2 (van de radicand-cijfers) en het 3²-kader diepte 1,
  waardoor ze verschillend hoog werden getekend ondanks een gelijke span.

Kortom: `[offsets]` is de meting, `[kader]` is wat je op het scherm ziet. Wijkt een
box net iets af, vergelijk dan de `[kader]`-regel met de `[offsets]` waaruit hij is
opgebouwd.
