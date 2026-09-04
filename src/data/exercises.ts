export interface ExerciseInfo {
  id: string;
  href: string;
  title: string;
  text: string;
  glyph: string;
  color: string;
}

export const EXERCISES: ExerciseInfo[] = [
  { id: "notas", href: "/practica/notas", title: "Leer notas", text: "Identifica la nota en el pentagrama.", glyph: "gClef", color: "bg-mint" },
  { id: "teclado", href: "/practica/teclado", title: "Tocar en el teclado", text: "Del pentagrama a la tecla exacta.", glyph: "fClef", color: "bg-lavender" },
  { id: "simbolos", href: "/practica/simbolos", title: "Símbolos", text: "Flashcards de dinámicas, articulaciones y más.", glyph: "dynamicForte", color: "bg-pink" },
  { id: "armaduras", href: "/practica/armaduras", title: "Armaduras", text: "Reconoce la tonalidad por sus alteraciones.", glyph: "accidentalSharp", color: "bg-yellow" },
  { id: "ritmo", href: "/practica/ritmo", title: "Ritmo", text: "Lee y golpea el ritmo con el metrónomo.", glyph: "noteQuarterUp", color: "bg-blue" },
  { id: "solfeo", href: "/practica/solfeo", title: "Solfeo", text: "Melodías para leer, cantar y comprobar.", glyph: "note8thUp", color: "bg-peach" },
  { id: "oido", href: "/practica/oido", title: "Oído", text: "Reconoce intervalos de oído.", glyph: "ornamentTrill", color: "bg-mint" },
];
