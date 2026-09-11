# Plan de desarrollo — Opus Piano

Aplicación web progresiva (PWA), en español, para aprender a leer partituras y tocar el piano.
Funciona entera sin conexión y sin cuenta; con cuenta, el progreso y las partituras siguen al
alumno de un dispositivo a otro. La descripción de lo que hay montado y cómo se despliega está
en el [README](./README.md); aquí está por qué está hecho así y qué falta.

## Stack

| Área | Elección | Motivo |
|------|----------|--------|
| Framework | Next.js 16 (App Router, salida *standalone*) | Páginas prerenderizadas para el curso (SEO) y API propia para cuentas, partituras e IA |
| UI | React 19 + Tailwind CSS 4 | Rápido, móvil primero |
| Notación musical | VexFlow 5 (dibujo propio) y Verovio 6 (grabado de la partitura original) | El dibujo propio suena y se sigue nota a nota; el grabado enseña la hoja tal y como está escrita |
| Glifos originales | Bravura / Bravura Text (SMuFL, OFL) | Son las fuentes de referencia del estándar; los símbolos son los originales |
| PDF | pdf.js (`pdfjs-dist`) | Visor de partituras en el navegador |
| Almacenamiento | IndexedDB (`idb`) + localStorage, y Postgres con cuenta | Sin cuenta nada sale del dispositivo; con cuenta se sincroniza |
| Audio | Web Audio API | Sintetizador de piano y metrónomo sin muestras externas |
| Entrada del alumno | Web MIDI y micrófono (`getUserMedia`) | Un teclado conectado o una palmada valen como respuesta |
| IA | Claude (clave del servidor) | Plan de estudio por partitura y profesor; el alumno no configura nada |
| OMR | Servicio propio (oemer sobre FastAPI) | Pasar un PDF a MusicXML sin claves ni pagos del usuario |
| Offline | Service worker propio con manifiesto generado tras el build | Sin dependencias extra, control total |

## Hecho

### Fases 0-8 — El curso y la biblioteca

- **Base**: PWA instalable, tema claro/oscuro, navegación inferior en móvil, fuentes propias.
- **Motor musical**: alturas, figuras, compases, armaduras, escalas e intervalos; `Score` (VexFlow),
  `Glyph` (SMuFL), sintetizador, metrónomo y secuenciador.
- **Teoría**: diez lecciones en tres bloques, catálogo completo de símbolos, glosario A-Z y FAQ.
- **Práctica**: siete ejercicios que corrigen solos (notas, teclado, símbolos, armaduras, ritmo,
  solfeo, oído) con progreso, rachas y estadísticas.
- **Mis partituras**: subida de PDF y MusicXML, biblioteca con miniaturas, visor con anotaciones a
  mano y digitaciones, catálogo de dominio público y partituras compartidas.
- **Cuentas**: registro propio (scrypt + sesión en base de datos) y Google opcional; el progreso y
  las partituras se sincronizan y se suman al entrar.
- **IA**: plan de estudio por partitura, agenda de sesiones con cronómetro, y profesor con y sin
  partitura delante, con techo de gasto mensual.
- **OMR**: transcripción de un PDF a MusicXML como encargo del servidor, que sobrevive a cerrar la
  pestaña.

### Fase 9 — Que la app escuche

Hasta aquí la app enseñaba a leer, pero de tocar solo sabía lo que el alumno declaraba.

- **Práctica adaptativa**: cada pregunta (una nota en su clave, una armadura, un intervalo) lleva su
  propia ficha y su caja de repaso espaciado; lo que se falla vuelve antes y lo asentado se aparta.
  La ficha vive solo en el dispositivo: es el cuaderno del ejercicio, no un resultado que enseñar.
- **Teclado MIDI** (`src/lib/midi.ts`): un teclado USB o Bluetooth responde en el ejercicio de
  teclado y mueve la partitura en el modo espera.
- **Micrófono** (`src/lib/audio/listen.ts`): el ritmo se marca con palmas y el solfeo se canta y se
  corrige nota a nota, sin grabar nada.
- **Ensayo en el visor**: repetir un trozo en bucle, callar una mano, cuenta atrás y subir el tempo
  vuelta a vuelta.
- **Modo espera**: la partitura no avanza hasta que se toca lo escrito; con una mano callada, esa la
  toca el alumno y la app pone la otra.
- **El plan contesta**: al acabar una sesión se pregunta cómo ha ido, y eso alarga, acorta o da por
  cumplido un objetivo. El profesor lo sabe.
- **Sesiones al calendario** (.ics): el aviso lo da el calendario del dispositivo, que funciona con
  la app cerrada y sin conexión.

## Lo que falta

Por orden de lo que más cambiaría la app:

1. **Medir cómo se toca, no solo qué se toca.** El modo espera comprueba las notas; no el tempo, ni
   la regularidad, ni si las dos manos van juntas. Con el reloj de audio y los golpes ya medidos, el
   siguiente paso natural es un informe por sesión: «compases 9-16 a ♩ = 72, tres tropiezos en el 12».
   Eso es lo que convertiría «he practicado 20 minutos» en algo que el plan pueda usar de verdad.
2. **Avisos push.** Las sesiones ya se exportan al calendario, que es suficiente y no necesita
   servidor. Un aviso propio exige claves VAPID, tabla de suscripciones y un programador; solo vale
   la pena si el calendario se queda corto.
3. **Modo profesor/alumno.** Ya hay cuentas, partituras compartidas y anotaciones: falta que un
   profesor asigne una pieza y vea el progreso de su alumno.
4. **El plan impreso.** Un PDF del plan y de la rutina para dejar en el atril.
5. **Sincronizar las fichas de práctica.** Hoy el repaso espaciado es de cada dispositivo. Sumarlo a
   la cuenta pide tabla, endpoint y una regla de fusión que no dé por sabido lo que se falla.
6. **Afinación y dinámica en el solfeo.** Se comprueba la nota; queda decir si se entra tarde o si se
   va cayendo de tono al final de la frase.
