import type { RouteDraft } from "@/lib/study-route";

/**
 * Ready-made routes: a plan you can adopt with one tap and then bend to your
 * own case. Pieces that exist in the app's catalogue carry `catalogId`, so
 * the score is one more tap away. Ids are stable within the template; they
 * only need to be unique inside the route.
 */
export interface RouteTemplate {
  id: string;
  /** What kind of student it's for, in a line. */
  audience: string;
  draft: RouteDraft;
}

export const ROUTE_TEMPLATES: RouteTemplate[] = [
  {
    id: "anna-magdalena-a-la-invencion",
    audience: "Ya tocas piezas de oído o de memoria, pero la lectura, la teoría y la técnica van por detrás.",
    draft: {
      name: "Del Cuaderno de Ana Magdalena a la Invención",
      level: "Principiante avanzado → intermedio temprano",
      goal: "Llevar la lectura, la teoría y la técnica al nivel de la capacidad práctica que ya existe. Repertorio y lectura son prácticas separadas: nunca dejar que memorizar sustituya a leer.",
      practice: "60 min · 6 días/sem.",
      pieces: [
        { id: "p01", title: "Minueto en re menor", detail: "BWV Anh. 132 · Cuaderno de A. M. Bach", why: "Primer contacto con dos voces, sin dificultad añadida.", estimate: "3–4 días", tag: "entrada", kind: "core", scoreId: null, catalogId: null, done: false, startedAt: null, doneAt: null },
        { id: "p02", title: "Minueto en sol mayor", detail: "BWV Anh. 114 · Cuaderno de A. M. Bach", why: "Independencia de voces, legato sin pedal, lectura real de ambas manos. Misma tonalidad que la escala en curso.", estimate: "3–4 sem.", tag: "", kind: "core", scoreId: null, catalogId: "minueto-sol-petzold", done: false, startedAt: null, doneAt: null },
        { id: "p03", title: "Minueto en sol menor", detail: "BWV Anh. 115 · Cuaderno de A. M. Bach", why: "Lo mismo, en menor. Armónica y melódica en contexto.", estimate: "2–3 sem.", tag: "", kind: "core", scoreId: null, catalogId: null, done: false, startedAt: null, doneAt: null },
        { id: "p04", title: "Pastorale", detail: "Burgmüller · Op. 100 n.º 3", why: "Cantabile, 6/8, pedal limpio. Contrapeso homofónico a Bach.", estimate: "2 sem.", tag: "", kind: "core", scoreId: null, catalogId: null, done: false, startedAt: null, doneAt: null },
        { id: "p05", title: "Marcha en re mayor", detail: "BWV Anh. 122 · Cuaderno de A. M. Bach", why: "Ritmos con puntillo, izquierda activa, carácter.", estimate: "2–3 sem.", tag: "", kind: "core", scoreId: null, catalogId: null, done: false, startedAt: null, doneAt: null },
        { id: "p06", title: "Sonatina op. 36 n.º 1 · I", detail: "Clementi", why: "Forma sonata, bajo de Alberti, escalas dentro de la música.", estimate: "3–4 sem.", tag: "", kind: "core", scoreId: null, catalogId: "clementi-sonatina-op36-1", done: false, startedAt: null, doneAt: null },
        { id: "p07", title: "Canción francesa antigua", detail: "Chaikovski · Álbum para la juventud op. 39 n.º 6", why: "Fraseo, balance melodía–bajo, lectura de textura a tres voces.", estimate: "1–2 sem.", tag: "", kind: "core", scoreId: null, catalogId: null, done: false, startedAt: null, doneAt: null },
        { id: "p08", title: "Musette en re mayor", detail: "BWV Anh. 126 · Cuaderno de A. M. Bach", why: "Bordón repetido, resistencia, semicorcheas en la derecha.", estimate: "2 sem.", tag: "", kind: "core", scoreId: null, catalogId: null, done: false, startedAt: null, doneAt: null },
        { id: "p09", title: "Ballade", detail: "Burgmüller · Op. 100 n.º 15", why: "Velocidad controlada, contraste dinámico, memoria por estructura.", estimate: "3 sem.", tag: "reto", kind: "core", scoreId: null, catalogId: null, done: false, startedAt: null, doneAt: null },
        { id: "p10", title: "Pequeño preludio en do mayor", detail: "Bach · BWV 939", why: "Puente hacia las Invenciones: arpegios y armonía funcional pura.", estimate: "2 sem.", tag: "", kind: "core", scoreId: null, catalogId: null, done: false, startedAt: null, doneAt: null },
        { id: "p11", title: "Invención n.º 1 en do mayor", detail: "Bach · BWV 772", why: "Dos voces plenamente independientes. Meta de los 12 meses.", estimate: "6–8 sem.", tag: "meta", kind: "core", scoreId: null, catalogId: null, done: false, startedAt: null, doneAt: null },
      ],
      routine: [
        { id: "r1", minutes: 5, title: "Calentamiento / lectura", content: "Beyer · 2 ejercicios nuevos · una sola pasada." },
        { id: "r2", minutes: 10, title: "Técnica", content: "Escala del mes (separadas → juntas, lento) · un estudio de Czerny." },
        { id: "r3", minutes: 10, title: "Lectura a primera vista", content: "Czerny op. 599 · 2 ejercicios nuevos de la zona de lectura." },
        { id: "r4", minutes: 10, title: "Teoría aplicada", content: "Siempre sobre la pieza obligatoria en curso, nunca abstracta." },
        { id: "r5", minutes: 30, title: "Repertorio", content: "Pieza obligatoria (20) · pieza de gusto (10). La obligatoria va primero. Con 30 minutos: 5 lectura · 5 escala · 20 pieza obligatoria. La lectura nunca se elimina." },
      ],
      goals: [
        { id: "g1", horizon: "1 mes", title: "Ruta 01 y 02 · Minueto en re menor terminado, Minueto en sol manos juntas de principio a fin, lento", done: false },
        { id: "g2", horizon: "1 mes", title: "Escala de la menor · tres formas · manos separadas", done: false },
        { id: "g3", horizon: "1 mes", title: "Escala de sol mayor · manos separadas", done: false },
        { id: "g4", horizon: "1 mes", title: "Tríadas mayores y menores en do, la m y sol, con inversiones", done: false },
        { id: "g5", horizon: "1 mes", title: "Lectura diaria sostenida 20 de 24 días", done: false },
        { id: "g6", horizon: "3 meses", title: "Ruta hasta 04 · Minueto en sol a tempo, de memoria y con partitura; sol menor y Pastorale terminadas", done: false },
        { id: "g7", horizon: "3 meses", title: "Escalas de do, la m, sol y re con digitado automático, manos juntas", done: false },
        { id: "g8", horizon: "3 meses", title: "Tríadas e inversiones comprendidas y tocadas en cualquier tonalidad conocida", done: false },
        { id: "g9", horizon: "3 meses", title: "Números romanos aplicados a los 8 primeros compases de dos piezas", done: false },
        { id: "g10", horizon: "3 meses", title: "Lectura fluida en la zona media del Beyer", done: false },
        { id: "g11", horizon: "6 meses", title: "Ruta hasta 07 · Sonatina de Clementi y Chaikovski terminadas", done: false },
        { id: "g12", horizon: "6 meses", title: "Czerny op. 599 hasta el n.º 70", done: false },
        { id: "g13", horizon: "6 meses", title: "Seis escalas mayores y dos menores", done: false },
        { id: "g14", horizon: "6 meses", title: "Cadencias y ii–V–I identificadas de oído y en partitura", done: false },
        { id: "g15", horizon: "6 meses", title: "Una pieza de gusto terminada con pedal limpio y balance correcto", done: false },
        { id: "g16", horizon: "12 meses", title: "Ruta completa · Invención n.º 1 terminada", done: false },
        { id: "g17", horizon: "12 meses", title: "Lectura a primera vista de material de intermedio temprano", done: false },
        { id: "g18", horizon: "12 meses", title: "Czerny op. 849 iniciado", done: false },
        { id: "g19", horizon: "12 meses", title: "Análisis armónico básico de cualquier pieza de la ruta sin ayuda", done: false },
      ],
      notes: [
        "## Material y dónde entrar",
        "- Beyer op. 101 (ed. Alfred) · pp. 82–107: lectura diaria, dos por día, una pasada, sin repetir ni corregir errores. p. 115 y p. 141: escalas de sol mayor y la menor. pp. 183 y 188: digitado de las 24 escalas; acordes con relativos menores.",
        "- Czerny op. 599 · n.º 20–45 para lectura a primera vista; n.º 46–70 como estudio técnico, uno o dos a la vez, 1–2 semanas cada uno. Del 71 en adelante, todavía no.",
        "- Hanon · n.º 1–10, máximo 5 min, transpuesto y con variaciones rítmicas. Prescindible.",
        "- IMSLP: todo el repertorio es de dominio público; preferir ediciones Urtext.",
        "",
        "Prueba de ubicación: tocar a primera vista un ejercicio de la zona sugerida. Si cuesta lo suficiente como para querer repetirlo, es demasiado difícil para lectura: bajar de número. El material de lectura debe sentirse casi fácil.",
        "",
        "## Cómo trabajar la pieza obligatoria",
        "- Manos separadas los primeros 2–3 días. En polifonía no es opcional: la izquierda es una melodía.",
        "- Sin pedal en Bach · legato con los dedos. En Burgmüller y Clementi, pedal solo donde la armonía lo pide.",
        "- Tempo de trabajo lento con metrónomo · subir solo cuando esté limpio.",
        "- Leer de la partitura al menos dos semanas, aunque ya esté memorizada.",
        "- Analizar los 8 primeros compases con números romanos · marcar las cadencias.",
        "- Tocarla de principio a fin sin detenerse, con errores, antes de darla por terminada.",
        "",
        "Terminada = a tempo, con partitura y de memoria, sin detenerse, y capaz de explicar en qué tonalidad está y dónde cierran sus secciones. No antes.",
        "",
        "Si una pieza se atasca más de dos semanas por encima de lo estimado, no se abandona: se reduce a la sección problemática, se trabaja manos separadas y se baja el tempo a la mitad.",
        "",
        "## Ruta de escalas",
        "Una escala nueva cada 3–4 semanas: do · la m · sol · re · fa · si♭ · la · mi · mi♭ · si. Manos separadas hasta que el digitado sea automático; después juntas, dos octavas. Con cada escala, la tríada de la tonalidad en fundamental y dos inversiones.",
        "",
        "## Ruta de teoría",
        "- Semanas 1–4: escalas mayores y menores · grados. Tocar cada escala nombrando los grados; identificar la tonalidad de cada pieza.",
        "- Semanas 5–8: tríadas mayor, menor, disminuida · inversiones. Conectar con cifrados conocidos: C/G es una segunda inversión.",
        "- Semanas 9–13: números romanos · I–IV–V · cadencias. Analizar el minueto; marcar la cadencia que cierra cada sección.",
        "- Semanas 14–17: ii–V–I · acordes de séptima. Tocar la progresión en varias tonalidades y transportarla.",
        "- Continuo: análisis armónico · frase · forma. Una pieza a la vez. Nunca se termina.",
        "",
        "La teoría se toca, no se lee. Cada concepto nuevo debe aparecer en la pieza obligatoria dentro de la misma semana.",
        "",
        "## Lectura a primera vista · cinco reglas",
        "1. Material fácil, siempre por debajo del nivel máximo de repertorio.",
        "2. Una sola pasada. No se repite; al día siguiente, material nuevo.",
        "3. No detenerse a corregir. Si hay error, se sigue.",
        "4. Tempo lento y parejo, metrónomo en ♩ = 60–70.",
        "5. Mirar adelante: los ojos van un compás por delante de las manos.",
        "",
        "## Pieza de gusto · en paralelo",
        "Una a la vez, elegida solo porque gusta. No cuenta para el plan y no necesita justificación: existe para mantener las ganas. Se trabaja después de la obligatoria, no en su lugar. Buscar siempre partitura con digitado.",
        "",
        "El plan existe para servir al músico, no al revés. Tocar cosas solo porque gustan es parte del plan, no una desviación de él.",
      ].join("\n"),
    },
  },
];

export const templateById = (id: string): RouteTemplate | undefined => ROUTE_TEMPLATES.find((t) => t.id === id);
