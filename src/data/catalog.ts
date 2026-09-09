import type { Level } from "@/lib/study-plan";

/**
 * Piezas de dominio público para empezar a tocar sin subir nada.
 *
 * La biblioteca vacía es lo primero que ve alguien que acaba de entrar, y
 * pedirle un PDF antes de darle nada es pedirle trabajo. Estas piezas se
 * añaden a su biblioteca con un toque y, como salen en MusicXML, traen todo
 * lo que la app sabe hacer: suenan, se ven nota a nota y se les puede pedir
 * un análisis.
 *
 * Todas son obras originales en MusicXML de bibliotecas de dominio
 * público, empaquetadas en `public/catalog/<id>.mxl`; la procedencia exacta
 * va en `origin`. Aquí no se escribe ni una nota: lo que no existe como
 * transcripción de verdad no entra. Las pocas piezas de nivel cero son
 * arreglos fáciles de esas mismas bibliotecas (`arranged`), y la ficha lo
 * dice.
 *
 * Sobre los derechos: todos los autores murieron hace más de un siglo (o
 * son tradicionales), así que la *obra* es de dominio público. Las
 * transcripciones vienen de bibliotecas que se declaran de dominio público,
 * y cada ficha dice de cuál.
 *
 * Cada pieza lleva además un análisis breve —qué es, por dónde atacarla y
 * dónde se atasca la gente— escrito a mano. No sustituye al análisis con IA
 * de la partitura: está antes, para decidir si es la pieza que toca ahora.
 */

export interface CatalogSource {
  /** Ruta pública del .mxl. */
  path: string;
  /** De qué biblioteca de dominio público sale la transcripción. */
  origin: { name: string; url: string };
  /** Arreglo fácil hecho por terceros, no la obra tal cual está escrita. */
  arranged?: boolean;
}

export interface CatalogAnalysis {
  /** Qué es y cómo está hecha: forma, tonalidad, carácter. Dos o tres frases. */
  summary: string;
  /** En qué orden trabajarla. */
  approach: string[];
  /** Dónde se suele atascar la gente. */
  watchOut: string[];
}

export interface CatalogPiece {
  id: string;
  title: string;
  composer: string;
  /** Año de la obra original: es lo que deja claro por qué puede estar aquí. */
  year: string;
  level: Level;
  /** Qué se practica con ella, en una frase. */
  about: string;
  /** Lo que conviene haber visto antes, para enlazarlo con las lecciones. */
  skills: string[];
  /** Compases, para la ficha (en las piezas de archivo no se puede contar sin abrirlo). */
  measures: number;
  source: CatalogSource;
  analysis: CatalogAnalysis;
}

const MUSETRAINER = { name: "MuseTrainer public domain MusicXML library", url: "https://github.com/musetrainer/library" };
const OSMD = { name: "OpenSheetMusicDisplay (partituras de prueba)", url: "https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/tree/develop/test/data" };

const file = (id: string, origin: { name: string; url: string }, arranged = false): CatalogSource => ({
  path: `/catalog/${id}.mxl`,
  origin,
  ...(arranged ? { arranged: true } : {}),
});

export const CATALOG: CatalogPiece[] = [
  {
    id: "oda-a-la-alegria-facil",
    title: "Oda a la alegría (arreglo fácil)",
    composer: "Ludwig van Beethoven",
    year: "1824",
    level: "principiante",
    about: "El tema de la Novena sinfonía en un arreglo fácil: la melodía en la derecha, casi toda por grados conjuntos, y un acorde largo por compás en la izquierda.",
    skills: ["Grados conjuntos", "Armadura de sol mayor", "Acordes de tres notas en la mano izquierda"],
    measures: 17,
    source: file("oda-a-la-alegria-facil", MUSETRAINER, true),
    analysis: {
      summary: "Dieciséis compases en sol mayor y 4/4, más uno de cierre, en dos frases de ocho: la primera acaba en la dominante y la segunda en la tónica. La derecha lleva el tema en negras y apenas se mueve más de una segunda cada vez; la izquierda sostiene un acorde por compás, en redondas y blancas, con solo tres acordes distintos (sol, re y do).",
      approach: [
        "Mano derecha sola, cantando los nombres: si-si-do-re, re-do-si-la. Casi todo es la nota de al lado.",
        "Mano izquierda sola: tres acordes, uno por compás. Aprende la forma de cada uno en la mano antes de mirar el pentagrama.",
        "Juntar por frases de cuatro compases, muy despacio. La izquierda solo cambia en el primer tiempo: es el momento de mirarla.",
        "El compás con la negra con puntillo (el cuarto de cada frase) se cuenta en voz alta hasta que salga solo.",
      ],
      watchOut: ["El fa es siempre sostenido: está en la armadura, no delante de la nota.", "En los compases centrales aparecen corcheas: no acelerar ahí.", "Los acordes de la izquierda se sostienen todo el compás; no soltarlos al tocar la siguiente nota de la derecha."],
    },
  },
  {
    id: "cumpleanos-feliz-facil",
    title: "Cumpleaños feliz (arreglo fácil)",
    composer: "Tradicional (sobre «Good Morning to All», de Patty y Mildred Hill)",
    year: "1893",
    level: "principiante",
    about: "La canción que todo el mundo conoce, con su anacrusa, en dos vueltas: la segunda añade una nota de paso cromática a la melodía y acordes de tres notas en la izquierda.",
    skills: ["Anacrusa", "Compás de 3/4", "Corchea con puntillo"],
    measures: 20,
    source: file("cumpleanos-feliz-facil", MUSETRAINER, true),
    analysis: {
      summary: "Do mayor y 3/4, dos vueltas de ocho compases precedidas de la anacrusa (sol-sol antes del primer compás). La melodía repite el mismo ritmo en cada frase: dos corcheas con puntillo de arranque y tres negras; la izquierda marca el bajo en el primer tiempo y dos acordes de dos notas en los otros dos, como un vals lento.",
      approach: [
        "Cuenta «uno, dos» y entra en el «tres» con las dos corcheas de la anacrusa: ese es el gesto que enseña la pieza.",
        "Mano derecha sola cantando la letra, que ya sabes: te dice dónde va cada nota.",
        "Mano izquierda sola: bajo en el primer tiempo y dos acordes ligeros después. Es el mismo patrón en casi todos los compases.",
        "La segunda vuelta es la primera con algún adorno; si la primera sale, la segunda es cuestión de leerla.",
      ],
      watchOut: ["El salto de octava del «feliz» (sol grave a sol agudo) se prepara abriendo la mano antes.", "En la segunda vuelta aparece un sol sostenido de paso: es un sostenido accidental, solo vale ese compás."],
    },
  },
  {
    id: "greensleeves-facil",
    title: "Greensleeves (arreglo fácil)",
    composer: "Tradicional inglesa",
    year: "s. XVI",
    level: "elemental",
    about: "La balada inglesa en la menor: melodía con puntillos en la derecha y un bajo de negras que dibuja el acorde en la izquierda.",
    skills: ["Compás de 3/4", "Negra con puntillo", "La menor: el sol sostenido de paso"],
    measures: 33,
    source: file("greensleeves-facil", MUSETRAINER, true),
    analysis: {
      summary: "La menor y 3/4, dos secciones de dieciséis compases con anacrusa: la primera empieza en la tónica y la segunda arriba, en el do agudo. La derecha lleva la melodía con el ritmo de negra con puntillo y corchea que la hace reconocible; la izquierda arpegia cada acorde en tres negras (fundamental, tercera, quinta), así que el bajo es siempre la primera nota del compás.",
      approach: [
        "Mano izquierda sola: tres negras por compás que dibujan el acorde. Nombra el acorde de cada compás (la menor, sol mayor, fa mayor, mi mayor) antes de tocarlo.",
        "Mano derecha sola con metrónomo, contando el puntillo: «uno-y-dos-y-tres-y», la corchea entra en el «y» del segundo tiempo.",
        "Juntar despacio la primera sección; la segunda repite la izquierda y cambia solo la melodía.",
        "Cuando salga, dejar respirar el final de cada frase: es una canción, no un ejercicio.",
      ],
      watchOut: ["El sol sostenido no está en la armadura: va escrito cada vez, y vuelve a ser natural en el compás siguiente.", "El puntillo se suele acortar; la corchea que sigue tiene que llegar tarde, no pronto.", "En la segunda sección algunas notas de la derecha van en terceras: la de arriba es la melodía."],
    },
  },
  {
    id: "canon-en-re-facil",
    title: "Canon en re mayor (arreglo fácil)",
    composer: "Johann Pachelbel",
    year: "c. 1680",
    level: "elemental",
    about: "El bajo de Pachelbel en corcheas, sin parar, bajo una melodía de notas largas que va creciendo: para aprender a mantener la izquierda estable.",
    skills: ["Armadura de re mayor", "Ostinato en la mano izquierda", "Corcheas regulares"],
    measures: 49,
    source: file("canon-en-re-facil", MUSETRAINER, true),
    analysis: {
      summary: "Re mayor y 4/4. La izquierda repite el mismo ciclo de ocho acordes (re, la, si menor, fa sostenido menor, sol, re, sol, la), arpegiado en corcheas, durante toda la pieza; la derecha entra a los cuatro compases con blancas, luego terceras y al final corcheas, como las voces del canon original. Cuarenta y nueve compases, pero de verdad solo hay que aprender cuatro de izquierda.",
      approach: [
        "Mano izquierda sola, los cuatro primeros compases, hasta poder repetirlos en bucle sin mirar. Es el ochenta por ciento de la pieza.",
        "Mano derecha sola por secciones: primero las blancas, luego las terceras. Cada una es una vuelta más del mismo ciclo.",
        "Juntar con metrónomo lento: la izquierda tiene que seguir igual cuando la derecha se complica.",
        "Subir el tempo solo cuando las corcheas de la izquierda sean parejas, sin acentos accidentales.",
      ],
      watchOut: ["Fa y do sostenidos siempre: dos sostenidos en la armadura.", "La izquierda tiende a arrastrarse cuando la derecha toca terceras: escúchala como un metrónomo.", "Es larga: mejor tocarla bien hasta la mitad que entera a trompicones."],
    },
  },
  {
    id: "minueto-sol-petzold",
    title: "Minueto en sol mayor, BWV Anh. 114",
    composer: "Christian Petzold (atribuido antes a J. S. Bach)",
    year: "c. 1725",
    level: "elemental",
    about: "El minueto del Cuaderno de Ana Magdalena Bach: la primera pieza «de verdad» de casi todo el mundo. Dos manos independientes, pero cada una sencilla.",
    skills: ["Armadura de sol mayor", "Compás de 3/4", "Frases de ocho compases con repetición"],
    measures: 32,
    source: file("minueto-sol-petzold", MUSETRAINER),
    analysis: {
      summary: "Forma binaria (dos partes de dieciséis compases, cada una repetida) en sol mayor y 3/4. La mano derecha lleva una melodía de negras y corcheas; la izquierda, un bajo de negras que casi siempre va a contratiempo de ella. La segunda parte pasa por re mayor antes de volver.",
      approach: [
        "Mano derecha sola por frases de cuatro compases; la primera (compases 1-4) tiene el salto característico re-sol y la escala que sube hasta el re agudo.",
        "Mano izquierda sola: casi todo negras. Fíjate en que se mueve cuando la derecha se para, y al revés: ese diálogo es el minueto.",
        "Juntar despacio (♩ = 60) con metrónomo: la independencia de manos es lo que se aprende aquí.",
        "Los adornos (trinos y mordentes) se dejan para el final o se omiten del todo; la pieza no los necesita para sonar bien.",
      ],
      watchOut: ["Fa sostenido siempre, también en la mano izquierda.", "El do sostenido de la segunda parte (modulación a re mayor) es la trampa clásica.", "No acentuar los tres tiempos igual: el minueto pesa en el primero."],
    },
  },
  {
    id: "schumann-jinete-salvaje",
    title: "El jinete salvaje, op. 68 n.º 8",
    composer: "Robert Schumann",
    year: "1848",
    level: "elemental",
    about: "Del Álbum para la juventud: rápida, corta y en staccato. Primera pieza donde el tema pasa a la mano izquierda.",
    skills: ["Compás de 6/8", "Staccato y acentos", "Leer en la menor y fa mayor"],
    measures: 27,
    source: file("schumann-jinete-salvaje", OSMD),
    analysis: {
      summary: "Forma ABA de veinticuatro compases en 6/8: A en la menor con el tema en la derecha y acordes secos en la izquierda; B en fa mayor con las manos cambiadas (el tema pasa abajo); vuelta a A. Todo staccato, todo con el acento en el primer y cuarto tiempo del compás.",
      approach: [
        "Aprende el tema de ocho compases en la mano derecha, con el ritmo galopante (corchea-corchea-corchea) bien marcado.",
        "Los acordes de la izquierda son cortos y ligeros: tócalos desde la muñeca, no desde el brazo.",
        "En la sección central, el mismo tema en la mano izquierda: mismo fraseo, mismos acentos.",
        "Primero a la mitad de tempo, cuadrando el staccato; la velocidad llega sola cuando los acordes están automatizados.",
      ],
      watchOut: ["Los sforzando (sf) marcan el galope; sin ellos la pieza es plana.", "No acelerar en la sección central: el cambio de manos suele arrastrar el tempo."],
    },
  },
  {
    id: "clementi-sonatina-op36-1",
    title: "Sonatina op. 36 n.º 1, I. Allegro",
    composer: "Muzio Clementi",
    year: "1797",
    level: "elemental",
    about: "La sonatina con la que se aprende lo que es una forma sonata: dos temas, un desarrollo y una vuelta. Escalas de do mayor con las dos manos.",
    skills: ["Escalas de do mayor con digitación", "Bajo de Alberti y octavas en la izquierda", "Compás de 2/4"],
    measures: 38,
    source: file("clementi-sonatina-op36-1", OSMD),
    analysis: {
      summary: "Forma sonata en miniatura, en do mayor y 2/4: primer tema en octavas paralelas (compases 1-7), segundo tema en sol mayor (compases 8-15), un desarrollo breve en sol menor y la reexposición. Treinta y ocho compases que contienen todo lo que hace una sonata grande.",
      approach: [
        "Antes de la pieza, la escala de do mayor con las dos manos: las corridas de semicorcheas de la derecha son esa escala con la digitación estándar.",
        "Compases 1-7: las dos manos tocan la misma línea a distancia de octava. Un solo gesto para las dos.",
        "El segundo tema (compás 8): bajo de Alberti en la izquierda con la mano quieta; la derecha canta encima.",
        "Trabajar por secciones y a tempo lento; el Allegro se gana en la última semana, no en la primera.",
      ],
      watchOut: ["Las escalas de semicorcheas: el pulgar pasa sin sacudida, y el tempo no se acelera al subir.", "El fa sostenido del segundo tema (sol mayor).", "El desarrollo en sol menor: si bemol y mi bemol de golpe."],
    },
  },
  {
    id: "satie-gymnopedie-1",
    title: "Gymnopédie n.º 1",
    composer: "Erik Satie",
    year: "1888",
    level: "elemental",
    about: "Lenta y suave: una melodía larga sobre un balanceo de bajo y acorde que no cambia en toda la pieza. Ideal para aprender el pedal y a tocar piano de verdad.",
    skills: ["Compás de 3/4 lento", "Acordes de tres notas en la izquierda", "Pedal de resonancia"],
    measures: 78,
    source: file("satie-gymnopedie-1", MUSETRAINER),
    analysis: {
      summary: "Setenta y ocho compases en 3/4, «lento y doloroso», con armadura de dos sostenidos pero armonía flotante (sol mayor con séptima y re mayor con séptima alternándose). La mano izquierda repite todo el rato el mismo gesto —un bajo en el primer tiempo y un acorde en el segundo y tercero— y la derecha canta una melodía larga, casi sin ritmo.",
      approach: [
        "Mano izquierda sola durante días: bajo en el 1, acorde en el 2 y el 3, hasta que el salto salga sin mirar. Es el 80 % de la pieza.",
        "Pedal por compás: pisar con el bajo, soltar y volver a pisar en el compás siguiente. La melodía va encima y no se moja.",
        "La mano derecha canta: notas largas, sin acentos, y el fraseo por grupos de cuatro compases.",
        "Toda la pieza va piano; la dificultad no es tocar las notas sino no tocarlas fuerte.",
      ],
      watchOut: ["Los acordes con séptima mayor (fa sostenido contra sol) suenan raros a solas: son así a propósito.", "No marcar el primer tiempo con acento aunque lleve el bajo.", "El tempo lento tiende a hundirse: lleva pulso por dentro."],
    },
  },
  {
    id: "bach-preludio-bwv846",
    title: "Preludio en do mayor, BWV 846",
    composer: "Johann Sebastian Bach",
    year: "1722",
    level: "intermedio",
    about: "El primer preludio de El clave bien temperado: un solo patrón de arpegio, repetido compás a compás sobre una cadena de acordes. Armonía pura para las dos manos.",
    skills: ["Arpegios con las dos manos", "Leer acordes", "Pedal cambiado por armonía"],
    measures: 35,
    source: file("bach-preludio-bwv846", OSMD),
    analysis: {
      summary: "Treinta y cinco compases en do mayor y 4/4 donde cada compás es el mismo dibujo: la mano izquierda sostiene dos notas y la derecha arpegia el resto del acorde, dos veces por compás. La pieza es una progresión armónica; los últimos compases (del 24 en adelante) descansan sobre un pedal de dominante y de tónica.",
      approach: [
        "Primero, cada compás como acorde bloqueado: las cinco notas juntas, con las dos manos. Así se aprende la armonía, que es la pieza.",
        "Luego arpegiado, con la misma digitación en todos los compases: el patrón es idéntico, solo cambian las notas.",
        "Las dos notas de la izquierda se mantienen todo el compás; el pedal se cambia con cada compás (y con cada acorde).",
        "Tempo tranquilo y absolutamente regular: no hay nada que correr.",
      ],
      watchOut: ["Los compases 22-23 (con el si bemol) y el pedal de sol de los compases 24-31 son la parte que hay que leer con calma.", "La tentación de acelerar cuando el patrón ya sale.", "El compás 34, con la escala final, es el único distinto."],
    },
  },
  {
    id: "beethoven-para-elisa",
    title: "Para Elisa, WoO 59",
    composer: "Ludwig van Beethoven",
    year: "1810",
    level: "intermedio",
    about: "La bagatela más famosa del mundo. El tema es fácil; las dos secciones centrales, no tanto: la pieza completa, no solo el principio.",
    skills: ["Compás de 3/8", "Arpegios repartidos entre manos", "Rondó: reconocer cuándo vuelve el tema"],
    measures: 106,
    source: file("beethoven-para-elisa", MUSETRAINER),
    analysis: {
      summary: "Rondó (A-B-A-C-A) en la menor y 3/8. El tema A es el mi–re sostenido que todo el mundo conoce, sobre arpegios que se reparten las dos manos. B (fa mayor, compás 23) tiene semicorcheas en la derecha con acompañamiento de acordes; C (compás 59) es la sección tormentosa con el bajo repetido de la y las corridas cromáticas.",
      approach: [
        "Tema A completo (compases 1-22) antes que nada: manos separadas, después juntas, prestando atención a cómo el arpegio de la izquierda continúa en la derecha.",
        "Sección B (compases 23-38): las semicorcheas de la derecha con metrónomo lento; el acompañamiento de la izquierda es un vals sencillo.",
        "Sección C (compases 59-82): la más difícil. La izquierda repite el la con muñeca suelta; la derecha aprende los acordes bloqueados primero.",
        "La subida cromática que devuelve al tema (compases 83-84) se estudia aparte, mano derecha sola.",
      ],
      watchOut: ["El pedal en los arpegios: cambiar con cada armonía o se emborrona todo.", "Tocar el tema demasiado fuerte: es pianissimo y sin prisa.", "En la sección C, el bajo repetido cansa si se toca desde el brazo."],
    },
  },
  {
    id: "mozart-sonata-k545-1",
    title: "Sonata en do mayor, K. 545, I. Allegro",
    composer: "Wolfgang Amadeus Mozart",
    year: "1788",
    level: "intermedio",
    about: "La «sonata fácil» de Mozart, que de fácil tiene solo el nombre. Escalas, bajo de Alberti y trinos con la limpieza que pide Mozart.",
    skills: ["Escalas mayores y menores a velocidad", "Bajo de Alberti", "Trinos y mordentes"],
    measures: 73,
    source: file("mozart-sonata-k545-1", MUSETRAINER),
    analysis: {
      summary: "Forma sonata en do mayor y 4/4. Primer tema (compases 1-4) sobre bajo de Alberti; escalas en los compases 5-12; segundo tema en sol mayor (compás 14). El desarrollo (compás 29) pasa por sol menor y re menor con arpegios rotos, y la reexposición vuelve —cosa rara— en fa mayor (compás 42) antes de acabar en do.",
      approach: [
        "Bajo de Alberti de los compases 1-4 con la mano izquierda sola, muy ligero: es el modelo para toda la pieza.",
        "Las escalas de los compases 5-12 con la digitación de la escala de do, y luego de sol y de la menor. Todo a tempo lento y limpio.",
        "El desarrollo, mano por mano: los arpegios rotos de la izquierda (compases 29-41) son los que suelen fallar.",
        "El trino del compás 4 (y sus repeticiones) se estudia como una figura suelta.",
      ],
      watchOut: ["Las escalas en las dos manos a la vez (compases 18-21 y equivalentes): pulgares coordinados.", "La reexposición en fa mayor: si bemol.", "Mozart se toca claro: sin pedal o con muy poco."],
    },
  },
  {
    id: "chopin-preludio-op28-4",
    title: "Preludio en mi menor, op. 28 n.º 4",
    composer: "Frédéric Chopin",
    year: "1839",
    level: "intermedio",
    about: "Veinticinco compases de acordes repetidos que bajan medio tono cada vez, y una melodía de notas largas encima. Poco que tocar, mucho que controlar.",
    skills: ["Acordes repetidos con cambios mínimos", "Cantabile con la mano derecha", "Dinámica de pianissimo"],
    measures: 26,
    source: file("chopin-preludio-op28-4", MUSETRAINER),
    analysis: {
      summary: "Largo en mi menor y compás de compasillo partido. La mano izquierda toca acordes de tres notas en corcheas durante toda la pieza; cada pocos compases cambia una sola nota, y así la armonía va bajando cromáticamente. La derecha lleva una melodía casi inmóvil que solo se agita en el clímax (compases 16-18), antes de la cadencia final con calderón.",
      approach: [
        "Mano izquierda sola, mirando qué dedo cambia de un acorde al siguiente: casi siempre uno solo. Los otros dos se quedan quietos.",
        "Los acordes se tocan pianissimo y sin acento, todos iguales: la mano descansa en las teclas, no cae sobre ellas.",
        "La melodía de la derecha, cantada primero; después con la izquierda, siempre por encima.",
        "El stretto de los compases 16-18 es el único lugar con prisa; el resto es contenerse.",
      ],
      watchOut: ["Pesadez en la izquierda: el error número uno.", "Cambiar el pedal con cada acorde nuevo, no con cada corchea.", "El calderón y el silencio antes de los tres acordes finales: aguantarlos de verdad."],
    },
  },
  {
    id: "chopin-vals-la-menor",
    title: "Vals en la menor, B. 150",
    composer: "Frédéric Chopin",
    year: "c. 1847",
    level: "intermedio",
    about: "El vals póstumo: la puerta de entrada a Chopin. Vals de mano izquierda, melodía con adornos y un trío en la mayor.",
    skills: ["Acompañamiento de vals (bajo, acorde, acorde)", "Mordentes y trinos", "Rubato con medida"],
    measures: 57,
    source: file("chopin-vals-la-menor", MUSETRAINER),
    analysis: {
      summary: "Vals en la menor y 3/4 en tres partes: el tema en la menor, un trío en la mayor (compás 25) más luminoso, y la vuelta del tema. La mano izquierda hace el vals de manual —bajo en el uno, acordes en el dos y el tres— y la derecha canta con mordentes y un trino largo antes de la vuelta.",
      approach: [
        "Mano izquierda sola, con el bajo del primer tiempo bien colocado y los acordes ligeros: es el mismo gesto en toda la pieza.",
        "La melodía sin adornos primero; los mordentes y el trino se añaden cuando la línea ya está en los dedos.",
        "El trío en la mayor: tres sostenidos; léelo aparte antes de tocarlo.",
        "El rubato: cede en las subidas y recupera en las bajadas, pero la mano izquierda no se descuadra.",
      ],
      watchOut: ["Los saltos del bajo en la izquierda: mirar el teclado no es trampa.", "El sol sostenido de la sensible, en las dos manos.", "El trino del compás 44 (aproximadamente): despacio primero."],
    },
  },
  {
    id: "clementi-sonatina-op36-3",
    title: "Sonatina op. 36 n.º 3, I. Spiritoso",
    composer: "Muzio Clementi",
    year: "1797",
    level: "intermedio",
    about: "La hermana mayor de la n.º 1: más larga, más rápida y con acompañamiento de Alberti casi continuo. El paso natural después de ella.",
    skills: ["Bajo de Alberti a velocidad", "Escalas y arpegios de do mayor", "Forma sonata"],
    measures: 64,
    source: file("clementi-sonatina-op36-3", OSMD),
    analysis: {
      summary: "Forma sonata en do mayor y 4/4, sesenta y cuatro compases. Primer tema con acordes y escalas; segundo tema en sol mayor sobre bajo de Alberti; desarrollo breve y reexposición. Lo que la n.º 1 insinúa, aquí está desplegado.",
      approach: [
        "Bajo de Alberti de la izquierda por secciones, con la mano quieta y el pulgar ligero: aquí dura mucho más que en la n.º 1.",
        "Las escalas y los arpegios de la derecha con las digitaciones de do mayor y sol mayor, antes de meterlos en la pieza.",
        "Estudiar por secciones (exposición, desarrollo, reexposición) y darse cuenta de qué se repite: la reexposición es la exposición sin cambiar de tono.",
        "Metrónomo desde el primer día y subir de cinco en cinco.",
      ],
      watchOut: ["La mano izquierda se pone rígida con el Alberti largo: parar y soltar.", "Las corcheas repetidas de la derecha: no pesan todas igual.", "El fa sostenido de la zona en sol mayor y el fa natural de la vuelta."],
    },
  },
  {
    id: "beethoven-claro-de-luna-1",
    title: "Sonata «Claro de luna», op. 27 n.º 2, I. Adagio sostenuto",
    composer: "Ludwig van Beethoven",
    year: "1801",
    level: "intermedio",
    about: "Tresillos sin parar en la mano derecha, con la melodía asomando en el dedo pequeño, sobre octavas lentas de la izquierda. Técnicamente asequible; musicalmente, no tanto.",
    skills: ["Tresillos regulares", "Melodía y acompañamiento en la misma mano", "Cuatro sostenidos"],
    measures: 69,
    source: file("beethoven-claro-de-luna-1", MUSETRAINER),
    analysis: {
      summary: "Adagio sostenuto en do sostenido menor, en compás de compasillo partido, sesenta y nueve compases. La mano derecha toca tresillos de corcheas de principio a fin y, a partir del compás 5, la melodía (el ritmo de corchea con puntillo y semicorchea) por encima de ellos, con el dedo 5. La izquierda son octavas de blancas y redondas. Beethoven pide tocarlo «delicadísimamente y sin sordina», es decir, con pedal.",
      approach: [
        "Tresillos solos, sin melodía, en pianissimo y con la mano relajada: los compases 1-4 lo son todo.",
        "La melodía sola, con su ritmo con puntillo, cantada y luego tocada con el dedo 5.",
        "Juntar: la melodía siempre por encima de los tresillos, que quedan como un fondo. Practicar la primera frase (compases 5-9) hasta que salga así.",
        "Pedal cambiado con cada armonía (casi siempre por compás, a veces por medio compás).",
      ],
      watchOut: ["Cuatro sostenidos, y muchos accidentales de paso.", "El ritmo de la melodía contra el tresillo: la semicorchea entra después de la tercera corchea, no con ella.", "Hundir los tresillos en el pedal: cambiar limpio."],
    },
  },
  {
    id: "chopin-nocturno-op9-2",
    title: "Nocturno en mi bemol mayor, op. 9 n.º 2",
    composer: "Frédéric Chopin",
    year: "1832",
    level: "avanzado",
    about: "El nocturno más conocido: una melodía que se adorna más cada vez que vuelve, sobre un vals amplio de la mano izquierda con saltos grandes.",
    skills: ["Ornamentación: mordentes, grupetos, notas de adorno", "Saltos en la mano izquierda", "Compás de 12/8 y rubato"],
    measures: 38,
    source: file("chopin-nocturno-op9-2", MUSETRAINER),
    analysis: {
      summary: "Andante en mi bemol mayor y 12/8. La mano izquierda hace un vals ancho (bajo, acorde, acorde) con saltos de más de una octava; la derecha canta una melodía de ocho compases que vuelve tres veces, cada vez más adornada, y acaba en una cadencia libre antes de los acordes finales.",
      approach: [
        "La melodía desnuda primero, como aparece la primera vez (compases 1-4): sin adornos, cantada.",
        "Mano izquierda sola, saltos incluidos, mirando el teclado. El bajo tiene que caer siempre en su sitio; los acordes son ligeros.",
        "Los adornos de las repeticiones se estudian como figuras aisladas y se meten cuando la línea base ya está.",
        "La cadencia final (compás 32) fuera de tempo, aparte; después, con el resto.",
      ],
      watchOut: ["Tres bemoles y muchos más de paso.", "El pedal por armonía, no por compás: el bajo cambia dentro del compás.", "Rubato sí, pero la izquierda mantiene la referencia."],
    },
  },
  {
    id: "mozart-rondo-alla-turca",
    title: "Rondó alla turca (Sonata K. 331, III)",
    composer: "Wolfgang Amadeus Mozart",
    year: "1783",
    level: "avanzado",
    about: "La «marcha turca»: semicorcheas rápidas, mordentes, y una sección en la mayor con octavas y acordes que imitan una banda de jenízaros.",
    skills: ["Semicorcheas a velocidad con la derecha", "Octavas y acordes", "Rondó con estribillo"],
    measures: 137,
    source: file("mozart-rondo-alla-turca", MUSETRAINER),
    analysis: {
      summary: "Allegretto en la menor y 2/4, con estructura de rondó: el tema en semicorcheas (la menor), un estribillo marcial en la mayor con octavas en la derecha y acordes repetidos en la izquierda, y una sección en fa sostenido menor. Termina con una coda brillante en la mayor.",
      approach: [
        "El tema (compases 1-8) en la derecha con la digitación decidida desde el principio; a tempo lento y con metrónomo.",
        "El estribillo en la mayor: primero los acordes de la izquierda (repetidos, ligeros), luego las octavas de la derecha aparte.",
        "Los mordentes se aprenden como parte de la nota, no como añadido: van con el pulso.",
        "La velocidad final se gana de dos en dos puntos de metrónomo a lo largo de semanas, no en una tarde.",
      ],
      watchOut: ["Las octavas de la coda: muñeca, no brazo, o duele.", "Las notas de adorno de la izquierda en el estribillo: cortas y antes del tiempo.", "Ir demasiado rápido demasiado pronto."],
    },
  },
  {
    id: "joplin-the-entertainer",
    title: "The Entertainer",
    composer: "Scott Joplin",
    year: "1902",
    level: "avanzado",
    about: "El rag más famoso: mano izquierda en «stride» (bajo y acorde alternos) y mano derecha sincopada. Joplin lo dejó escrito: los rags nunca se tocan rápido.",
    skills: ["Síncopa: contar semicorcheas", "Acompañamiento stride", "Octavas y acordes en la derecha"],
    measures: 92,
    source: file("joplin-the-entertainer", MUSETRAINER),
    analysis: {
      summary: "Rag en do mayor y 2/4, «not fast»: una introducción de cuatro compases y cuatro secciones de dieciséis (A-A-B-B-A-C-C-D-D), la C en fa mayor. La izquierda alterna un bajo (a veces en octava) con un acorde en cada corchea; la derecha lleva la melodía sincopada, con acordes y octavas.",
      approach: [
        "Mano izquierda sola, sección por sección, a tempo lento: el stride es un salto constante y hay que aprenderlo mirando.",
        "La derecha con las semicorcheas contadas en voz alta (un-e-y-a): la síncopa es que la nota cae en la «y» o en la «a», no en el número.",
        "Una sección cada vez, primero A, y no pasar a B hasta que A vaya con las dos manos.",
        "Tempo moderado siempre: un rag rápido es un rag mal tocado.",
      ],
      watchOut: ["Los saltos de la izquierda en la sección B (más grandes).", "La sección C en fa mayor: si bemol.", "Las octavas de la derecha en la sección D."],
    },
  },
  {
    id: "joplin-maple-leaf-rag",
    title: "Maple Leaf Rag",
    composer: "Scott Joplin",
    year: "1899",
    level: "avanzado",
    about: "El rag que hizo famoso a Joplin. Cuatro bemoles, un trío en re bemol y una mano izquierda que no para de saltar: más exigente que The Entertainer.",
    skills: ["Stride con saltos grandes", "Leer en la bemol y re bemol mayor", "Síncopas complejas"],
    measures: 85,
    source: file("joplin-maple-leaf-rag", MUSETRAINER),
    analysis: {
      summary: "Rag en la bemol mayor y 2/4, con cuatro secciones de dieciséis compases (A-A-B-B-A-C-C-D-D) y el trío (C) en re bemol mayor. Mano izquierda en stride con saltos anchos y acordes de cuatro notas; mano derecha con acordes sincopados y octavas rotas.",
      approach: [
        "Las escalas de la bemol y re bemol mayor antes de la pieza: hay que tener los bemoles en los dedos.",
        "Mano izquierda sola, muy lenta, sección por sección; los saltos se miran y se preparan con el brazo antes de tocar.",
        "La derecha por acordes bloqueados primero, y después con el ritmo sincopado.",
        "El trío en re bemol como pieza aparte: es otra tonalidad y otro carácter.",
      ],
      watchOut: ["Cinco bemoles en el trío.", "El tempo: Joplin escribió «tempo di marcia», no «presto».", "Los acordes de cuatro notas de la izquierda: soltar la mano entre salto y salto."],
    },
  },
  {
    id: "debussy-claro-de-luna",
    title: "Claro de luna (Suite bergamasque, III)",
    composer: "Claude Debussy",
    year: "1905",
    level: "avanzado",
    about: "Cinco bemoles, 9/8 y arpegios repartidos entre las dos manos. Pide un control del pedal y del pianissimo que se aprende precisamente aquí.",
    skills: ["Compás de 9/8", "Arpegios entre las dos manos", "Pedal por armonía y ppp real"],
    measures: 72,
    source: file("debussy-claro-de-luna", MUSETRAINER),
    analysis: {
      summary: "Andante muy expresivo en re bemol mayor y 9/8, setenta y dos compases. Tres partes: los acordes en terceras del principio (pianissimo, sin prisa), la sección central con arpegios continuos repartidos entre las manos (a partir del compás 27) que pasa por mi mayor, y la vuelta del tema sobre los arpegios.",
      approach: [
        "La primera sección con las dos manos por acordes, sin pedal, para oír las terceras limpias; luego con pedal, cambiado por armonía.",
        "Los arpegios de la sección central (compás 27 en adelante): decidir qué notas van a cada mano y no cambiarlo. Mano izquierda sola, después juntas y lento.",
        "La sección en mi mayor (compases 37-42) como isla aparte: cuatro sostenidos después de cinco bemoles.",
        "Toda la pieza va entre ppp y p: trabajar el sonido, no las notas.",
      ],
      watchOut: ["Cinco bemoles y cambios de armadura por el medio.", "El 9/8: tres pulsos de tres corcheas, y los tresillos de semicorcheas dentro.", "Pedal generoso pero cambiado: si no, se embarra."],
    },
  },
  {
    id: "beethoven-patetica-2",
    title: "Sonata «Patética», op. 13, II. Adagio cantabile",
    composer: "Ludwig van Beethoven",
    year: "1798",
    level: "avanzado",
    about: "Uno de los temas más bellos del piano, a tres voces: la melodía canta por encima de su propio acompañamiento en la misma mano.",
    skills: ["Voces en la misma mano", "Cuatro bemoles", "Tresillos de acompañamiento"],
    measures: 73,
    source: file("beethoven-patetica-2", MUSETRAINER),
    analysis: {
      summary: "Adagio cantabile en la bemol mayor y 2/4, con forma de rondó (A-B-A-C-A). El tema A tiene la melodía en la parte superior de la mano derecha, un acompañamiento en semicorcheas en la misma mano y el bajo en la izquierda. B (compás 17) pasa a fa menor; C (compás 37) a la bemol menor con tresillos, que se quedan como acompañamiento cuando el tema vuelve por última vez.",
      approach: [
        "La melodía sola con el dedo 4-5 de la derecha, cantándola; después el acompañamiento solo con 1-2-3 de la misma mano; luego juntos, con la melodía por encima. Este equilibrio es la pieza.",
        "El bajo de la izquierda, ligado y sin peso.",
        "La sección C con los tresillos aparte: son un nuevo acompañamiento que luego se lleva el tema.",
        "Cuatro bemoles, y siete en la sección en la bemol menor: leer despacio antes de tocar.",
      ],
      watchOut: ["El acompañamiento tapa la melodía si los dedos 1-2-3 pesan lo mismo que el 5.", "Los tresillos de la vuelta final contra el ritmo de la melodía.", "El tempo: adagio, pero cantabile; que no se muera."],
    },
  },
];

export const pieceById = (id: string): CatalogPiece | undefined => CATALOG.find((p) => p.id === id);

/** Las piezas agrupadas por nivel, en el orden en que conviene tocarlas. */
export const LEVEL_ORDER: Level[] = ["principiante", "elemental", "intermedio", "avanzado"];

export function piecesByLevel(): { level: Level; pieces: CatalogPiece[] }[] {
  return LEVEL_ORDER.map((level) => ({ level, pieces: CATALOG.filter((p) => p.level === level) })).filter((g) => g.pieces.length > 0);
}
