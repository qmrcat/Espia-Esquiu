# L'Espia Esmunyedís

Trencaclosques de lògica per al navegador. Reorganitza les peces del tauler perquè cap fletxa no delati els espies.

La pàgina és autònoma: HTML, CSS i JavaScript sense cap framework ni llibreria externa. No cal servidor ni connexió a internet.

## Com començar

1. Desa `index.html`, `styles.css` i `game.js` a la mateixa carpeta.
2. Obre `index.html` amb qualsevol navegador modern (Chrome, Firefox, Safari o Edge, també al mòbil).

Si el vols publicar, puja els tres fitxers a qualsevol allotjament estàtic (GitHub Pages, Netlify, el teu servidor…).

## Regles

Totes les caselles, menys les dels espies, tenen una peça: una **fletxa** o una **peça blanca**. El nivell està resolt quan es compleixen alhora aquestes condicions:

1. Cada fletxa apunta a la casella del costat en la seva direcció, i allà hi ha d'haver una peça blanca.
2. Cap fletxa no pot apuntar a una altra fletxa, a un espia ni fora del tauler.
3. Cada peça blanca ha de rebre almenys una fletxa.

| Peça | Descripció |
|------|------------|
| Fletxa recta (ambre) | Gira de 90 en 90°. Sempre continua sent recta. |
| Fletxa diagonal (turquesa) | Gira de 90 en 90°. Sempre continua sent diagonal. |
| Peça blanca | Ha de rebre alguna fletxa. Mentre no en rep cap, es marca en vermell amb un «!». |
| Espia | No es mou i cap fletxa no l'ha d'assenyalar. |

Cada nivell afegeix un espia, fins al màxim que admet la mida del tauler (3 al 4×4, 5 al 5×5 i 7 al 6×6). Els espies mai no es toquen entre ells.

## Controls

| Acció | Ratolí / pantalla tàctil | Teclat |
|-------|--------------------------|--------|
| Intercanviar dues peces | Arrossega una peça sobre l'altra | <kbd>Espai</kbd> per agafar, mou-te, <kbd>Espai</kbd> per deixar |
| Girar a la dreta | Clic o toc sobre la fletxa | <kbd>R</kbd> |
| Girar a l'esquerra | Clic dret | <kbd>Maj</kbd> + <kbd>R</kbd> |
| Moure el cursor | — | Tecles de fletxa |
| Desfer | Botó «Desfer» | <kbd>Ctrl</kbd> + <kbd>Z</kbd> |
| Cancel·lar la selecció | — | <kbd>Esc</kbd> |

Amb el ratolí, en passar per sobre d'una fletxa es ressalta la casella on apunta: en verd si és correcte i en vermell si no.

## Ajudes i puntuació

- **Demo:** el botó «▶ Demo» (o «Mira la demo animada», a «Com es juga») obre un tauler 3×3 on un cursor resol el trencaclosques pas a pas, amb explicacions. Es pot posar en pausa, tornar a veure i tancar amb <kbd>Esc</kbd>. Mentre està oberta, el temps de la partida s'atura.
- **Peces blanques soles:** sempre es marquen les que encara no rep cap fletxa.
- **Errors en directe:** interruptor per veure tots els errors mentre jugues.
- **Comprovar:** mostra els errors durant uns segons i explica el primer.
- **Pista:** col·loca una peça a la seva posició correcta i la fixa (amb un cadenat).
- **Estrelles:** 3 sense pistes, 2 amb una o dues pistes, 1 amb més.
- **Rècords:** el nivell més alt i el millor temps sense pistes de cada mida es desen al navegador (`localStorage`, clau `espia-esmunyedis-v2`).

La victòria es detecta automàticament quan el tauler és correcte.

## Estructura dels fitxers

```
index.html   Estructura de la pàgina, regles i finestra de victòria
styles.css   Disseny, animacions i adaptació al mòbil
game.js      Lògica del joc (sense dependències)
README.md    Aquest document
```

### Parts principals de `game.js`

| Funció | Què fa |
|--------|--------|
| `generatePuzzle()` / `buildSolution()` | Construeixen una solució vàlida. |
| `scramble()` | Barreja posicions i girs a partir de la solució, així que tots els nivells tenen solució. |
| `analyze()` | Retorna els errors del tauler: `out`, `spy`, `arrow` i `lonely` (peça blanca sense fletxa). |
| `afterChange()` | Actualitza marques, marcador i botons després de cada moviment, i detecta la victòria. |
| `doSwap()` / `doRotate()` / `undo()` / `hint()` | Accions del jugador. |
| `runDemo()` / `DEMO_STEPS` | Demo animada: tauler inicial (`DEMO_START`) i passos amb el text i les accions de cada un. |
| `sfx()` / `confetti()` | Sons (Web Audio) i confeti (canvas), generats al moment sense fitxers. |

Les direccions es guarden com un índex de 0 a 7 en sentit horari, començant per «amunt». Els índexs parells són rectes i els senars, diagonals.

## Personalització

Al començament de `game.js`:

- `MAX_SPIES`: nombre màxim d'espies per mida de tauler.
- `BLANK_RATIO`: proporció aproximada de peces blanques (més alt vol dir més fàcil).

Els colors es defineixen com a variables CSS a `:root`, al principi de `styles.css`.

## Accessibilitat

- Totes les accions es poden fer només amb el teclat.
- Cada peça té una etiqueta per als lectors de pantalla (tipus, direcció, posició, i si està sola o fixada).
- Si el sistema té activada l'opció de reduir el moviment, les animacions i el confeti es desactiven.
