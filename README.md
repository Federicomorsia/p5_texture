# Wind flow · Halftone dots · Metaballs

Tre effetti generativi in p5.js a tutto schermo, selezionabili dal pannello: **Wind flow**, con scie bianche su fondo nero, **Halftone dots**, con punti neri su fondo bianco, e **Metaballs**, con cerchi avorio che si fondono su fondo scuro. Il movimento è autonomo. Il nuovo effetto Halftone dots viene mostrato al primo avvio; in seguito viene ricordata l’ultima selezione.

## Avvio

Apri `index.html` nel browser. La libreria p5.js 1.11.11 è inclusa in `vendor/`, quindi funziona anche offline e non richiede installazioni o build.

In alternativa, dalla cartella del progetto:

```sh
python3 -m http.server 8000
```

Apri http://localhost:8000.

## Controlli

- Il pulsante con il nome dell’effetto, in basso a destra, apre e chiude il pannello.
- **Effetto** permette di passare tra Wind flow, Halftone dots e Metaballs. Il pannello cambia tema e mostra i controlli dell’effetto selezionato.
- **H** mostra o nasconde il pannello; **Esc** lo chiude.
- **Wind flow:** velocità, densità, lunghezza, curvatura, spessore e direzione.
- **Halftone dots:** velocità, passo della griglia, dimensione massima dei punti, scala delle forme, copertura e contrasto. **Nuova forma** genera una nuova distribuzione casuale.
- **Metaballs:** velocità, numero e raggio dei cerchi, intensità della fusione e ampiezza del movimento. **Nuova forma** rigenera la disposizione.
- **Pausa / Riprendi** controlla l’animazione. **Ripristina** reimposta i parametri iniziali del solo effetto selezionato.
- Ogni effetto conserva i propri parametri, anche cambiando modalità. Le impostazioni e l’ultima modalità scelta vengono salvate nel browser quando lo storage è disponibile.
- Se il sistema richiede movimento ridotto, l’animazione parte in pausa: usa **Riprendi** per avviarla.

## Struttura

- `flow.js`: crescita, testa/coda e controllo geometrico delle distanze.
- `wind-field.js`: campo di velocità condiviso, correnti e vortici.
- `trail-renderer.js`: tratti continui con sfumature prive di giunzioni sovrapposte.
- `halftone.js`: griglia fissa e modulazione animata dei diametri.
- `metaballs.js`: movimento dei cerchi e shader GLSL di fusione su buffer p5 WEBGL.
- `sketch.js`: selettore, impostazioni separate e ciclo di animazione. `effects` contiene valori iniziali e intervalli dei controlli.
- `style.css`: pannello e impaginazione a tutto schermo.
- `vendor/p5.min.js`: libreria p5.js, con avviso di licenza incluso.

## Halftone dots

I centri dei punti sono bloccati su una griglia quadrata: `(colonna + 0,5) × passo`, `(riga + 0,5) × passo`. Il passo resta fisso durante l’animazione. Una combinazione di campi Perlin 3D di p5.js deforma lentamente le forme; cambia soltanto il raggio dei cerchi, senza spostamenti o variazioni casuali a ogni frame.

I cerchi sono pieni, neri, su fondo bianco. Il diametro massimo è una frazione del passo (90% come valore iniziale e al massimo 98%), per mantenere sempre separati i punti. **Scala delle forme** controlla la dimensione delle zone organiche, **Copertura** quanto si riempie la griglia, **Contrasto** la gradualità del passaggio da punti piccoli a grandi. Il campo è visibile anche in pausa. Cambiando effetto, il tempo dell’effetto nascosto resta fermo.

## Metaballs

L’effetto usa uno [shader GLSL creato con p5.js](https://p5js.org/reference/p5/createShader/) su un buffer WEBGL, allocato solo quando si seleziona Metaballs. Ogni pixel calcola la distanza dai cerchi in movimento; una unione morbida delle distanze forma i raccordi quando i cerchi si avvicinano. Riducendo **Fusione** a zero si ottiene l’unione geometrica semplice. Aumentandola, i raccordi compaiono a distanze maggiori.

Il fondo è `#121212`, le forme sono avorio `#f2efe5`. I bordi sono antialias direttamente nello shader. I cerchi mantengono proporzioni circolari anche su viewport larghi; i bordi del frame sono periodici, quindi le forme possono attraversarli senza salti. Il tempo si ferma durante la pausa e quando è selezionato un altro effetto. Il buffer viene riutilizzato, ridimensionato con il viewport e limitato a circa 2,4 milioni di pixel per contenere il carico grafico. Su finestre molto piccole il raggio viene limitato al 24% del lato corto.

Gli shader sono inclusi come stringhe JavaScript: non richiedono richieste di rete e l’apertura locale di `index.html` rimane supportata. È necessario WebGL; se il contesto grafico non può essere creato, gli altri effetti restano selezionabili.

## Wind flow: disegno e movimento

Ogni scia è un unico tratto Canvas con una sfumatura continua, senza segmenti arrotondati sovrapposti o una seconda testa luminosa. Il gradiente segue la progressione del percorso usando punti proiettati; i percorsi limitano la variazione totale della tangente a 1,3 radianti, per evitare ripiegamenti del gradiente. Il canvas usa almeno 2× la risoluzione CSS dove il budget di 24 milioni di pixel lo consente, fino a 3× sui display compatibili.

Il vento è un campo bidimensionale derivato analiticamente da una funzione di corrente: `v = (∂ψ/∂y, −∂ψ/∂x)`. Combina corrente principale, onde e vortici ampi, senza sorgenti o pozzi artificiali. Le teste seguono traiettorie integrate con Runge–Kutta di ordine 4, campionate ogni 3 px; la loro velocità dipende dal campo locale, senza moltiplicatori casuali individuali. Un fattore temporale comune introduce variazioni lente di intensità. Il campo spaziale resta stabile per mantenere coerenti le traiettorie.

È un modello procedurale incomprimibile, non una simulazione meteorologica o un solutore delle equazioni di Navier–Stokes. Il principio di costruire campi incomprimibili a partire da un potenziale è descritto anche in [Curl-Noise for Procedural Fluid Flow, Bridson et al.](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf); qui il potenziale è analitico, senza rumore Perlin.

Ogni filamento nasce con lunghezza zero. La testa avanza e la coda resta ferma durante la crescita, poi segue la testa. La scia si dissolve prima della fine del percorso, mentre continua a muoversi: nessuna testa rimane ferma in attesa della coda.

I percorsi sono controllati prima della crescita, con almeno 2,6 px tra linee centrali (0,6 px di spazio geometrico allo spessore massimo). La densità è subordinata allo spazio disponibile. La dissolvenza vicino al termine del percorso e la distanza minima sono regole visive per mantenere le scie separate, non ostacoli fisici nel vento. Direzione e curvatura interessano le nuove scie; quelle già presenti terminano il proprio percorso. Ridimensionando la finestra, le linee ricominciano da zero per preservare le distanze.

## Verifica

```sh
node --test
```
