# Uitleg — waarom de waarde-check niet volstaat, en of een hash dat oplost

**Belangrijke secundaire informatie** over de validatie van leerling-invoer in de
studenttool. Verwant: `../poc_relaties/UITLEG_vingerafdruk.md` (daar staat wat een
hash/vingerafdruk precies is en doet).

---

## De vraag

De studenttool controleert of de invoer van een leerling nog voldoet, o.a. door
naar de **canonieke waarde** van de expressie te kijken: rekent deze regel uit tot
dezelfde uitkomst als het eindantwoord van het vraagstuk?

- **Waarde wijkt af** → er zit zéker een fout in de regel.
- **Waarde klopt** → we weten nog *niet* zeker dat de regel goed is. **Twee fouten
  achter elkaar kunnen elkaar opheffen.**

Vraag: kunnen we dat laatste probleem met een **hash** ondervangen?

---

## 1. De waarde-check is *veel-op-één*

De canonieke waarde zegt alleen: "deze expressie rekent uit tot het eindantwoord".
Maar **heel veel verschillende (ook foute) expressies rekenen uit tot dezelfde
waarde**. `12 + 3` en `10 + 5` zijn allebei 15; twee compenserende fouten
(`10→12` én `5→3`) glippen door een pure waarde-check heen.

Dat is geen implementatie-tekort maar iets principieels: waarde-gelijkheid is een
**veel-op-één-afbeelding**. Ze is daarom **noodzakelijk maar niet voldoende** —
een verkeerde waarde bewijst een fout, een juiste waarde bewijst niets.

---

## 2. Kan een hash dit ondervangen? Het hangt af van *waarvan* je de hash neemt

### Hash van de wáárde → nee
Hash je de uitkomst (`15`), dan heb je exact hetzelfde probleem: dezelfde waarde
geeft dezelfde hash. `12+3` en `10+5` hashen identiek. Geen winst.

### Hash van de structuur → in principe wél, mits twee dingen
Verschillende expressie-*structuren* geven verschillende hashes, dus je zou "dit is
niet de verwachte structuur" kunnen detecteren. Maar dan heb je nodig:

1. **Iets juists om tegen te vergelijken** — de verwachte structuur(en) ná een
   geldige stap.
2. **Een canonicalisatie** die álle geldige notaties van dezelfde structuur naar
   dezelfde hash brengt (anders keur je een correcte regel in nét andere notatie
   ten onrechte af).

---

## 3. Die twee heb je al — en het is precies wat de *matcher* doet

Het reductiemodel weet na elke stap wélke expressies geldig zijn: de vorige regel
met precies één klaar-mathblock gereduceerd tot z'n **correcte** output (voor elk
klaar mathblock — dat is Route B). Dat is een *bekende* verzameling juiste
structuren. De matcher (`checkStep`) vergelijkt de leerling-regel daar
**structureel** mee — per mathblock, als **enkelvoudige-bewerking-transitie**.

Dat is juist de controle die de waarde-check mist: de matcher eist dat de leerling
**exact één mathblock naar z'n juiste uitkomst** heeft gereduceerd. Twee
compenserende fouten zijn géén geldige enkelvoudige reductie → de matcher merkt ze
als `AFWIJKEND` (of niet-herleidbaar).

> **De compenserende-fouten-vraag is dus al opgelost — niet door een hash, maar
> door per-stap structureel te valideren.** De waarde-check is de grove poort; de
> matcher is de fijne, structurele controle daarachter.

Waarom de matcher sterker is dan de waarde-check: hij kijkt niet naar de eindwaarde
van de hele regel, maar valideert **elke gewijzigde mathblock afzonderlijk** tegen
z'n verwachte output. Een fout in één mathblock is `AFWIJKEND`, ongeacht of de rest
van de expressie de totale waarde toevallig weer glad strijkt.

---

## 4. Een hash-variant is denkbaar, maar voegt niets fundamenteels toe

Je zou het elegant kunnen formuleren: hash elke geldige-volgende-structuur,
canonicaliseer de leerling-regel, en check of z'n hash **in die verzameling** zit.
Dat vangt compenserende fouten (die zitten niet in de verzameling). Maar het staat
of valt met voorwaarde 2 — de **canonicalisatie** — en dát is nu juist het echte,
moeilijke werk. De matcher lost dat op met een **tolerante boom-vergelijking**
(`treesEqual` + canonieke bladvormen + `locateBoundary`), niet met een starre hash.

Een hash-gelijkheid is bovendien **strikter en minder notatie-tolerant**: elke
legale notatie-variant die je canonicalisatie niet platslaat, wordt vals afgekeurd.
Je verplaatst het probleem dan van "vergelijk structuren" naar "canonicaliseer
perfect" — je lost het niet op.

Bijkomend: er is **niet één** juiste afleiding om tegen te hashen. De leerling mag
klaar-bewerkingen in willekeurige volgorde doen, dus de "juiste structuur" is een
hele *verzameling* (alle volgordes × alle geldige tussenvormen). Het reductiemodel
loopt die verzameling **incrementeel per stap** af — en dat ís de matcher.

---

## 5. Waarom de vingerafdruk (bij relaties) daar wél schoon werkt

De prefix-vingerafdruk uit `relaties.json` werkt zo netjes omdat **beide kanten
geauthored en canoniek** zijn: twee door de authortool geproduceerde grafen, in
gegarandeerd dezelfde vorm. Bij leerling-validatie is de ene kant **vrije invoer**
in willekeurige notatie — dáár zit de moeilijkheid, en die verschuift een hash niet
weg; die vraagt om de tolerante structurele vergelijking die de matcher al doet.

Kortom: een hash is een prima *anker* om **twee bekende, canonieke structuren** te
vergelijken (relatie-prefix). Het is geen geschikt gereedschap om **vrije invoer**
tegen een verzameling geldige vervolg-structuren te toetsen — dat is het werk van
de matcher.

---

## 6. Waar dan wél nog een gat zit

De matcher lost het op **zolang hij de wijziging kan toeschrijven**. Kan hij dat
niet (de niet-herleidbaar-route, `pinpointFromMatcher → type 2`), dan valt de tool
terug op de grovere waarde-check — en dáár kan een compenserende fout alsnog
doorglippen. Dat gat dicht je **niet met een hash** (een hash heeft nog steeds de
verwachte structuur nodig om tegen te vergelijken, en die heeft de matcher juist
niet als hij niet kan toeschrijven), maar met **betere toeschrijving/lokalisatie**
— precies het PPTE-werk (fout herleidbaar maken en anders "niet herleidbaar" tonen
in plaats van stil goedkeuren).

---

## Samengevat

> Een hash lost het compenserende-fouten-probleem niet op als je 'm op de *waarde*
> legt, en voegt niets fundamenteels toe als je 'm op de *structuur* legt — want
> dan doe je in feite de structurele stap-controle die de matcher al doet, alleen
> strikter en minder notatie-tolerant. De echte oplossing is wat de studenttool al
> heeft: **elke regel valideren als geldige enkelvoudige reductie per mathblock**,
> niet alleen de eindwaarde checken. De vingerafdruk blijft het juiste gereedschap
> voor z'n eigen taak: twee bekende, canonieke structuren vergelijken.
