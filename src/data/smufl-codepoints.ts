// Generado por scripts/gen-smufl.mjs — no editar a mano.
// Puntos de código SMuFL (https://w3c.github.io/smufl/) de los glifos usados en la app.
export const SMUFL: Record<string, string> = {
  accidentalDoubleFlat: "\u{E264}", // Double flat
  accidentalDoubleSharp: "\u{E263}", // Double sharp
  accidentalFlat: "\u{E260}", // Flat
  accidentalNatural: "\u{E261}", // Natural
  accidentalParensLeft: "\u{E26A}", // Accidental parenthesis, left
  accidentalParensRight: "\u{E26B}", // Accidental parenthesis, right
  accidentalSharp: "\u{E262}", // Sharp
  arpeggiatoUp: "\u{E634}", // Arpeggiato up
  articAccentAbove: "\u{E4A0}", // Accent above
  articMarcatoAbove: "\u{E4AC}", // Marcato above
  articStaccatissimoAbove: "\u{E4A6}", // Staccatissimo above
  articStaccatoAbove: "\u{E4A2}", // Staccato above
  articTenutoAbove: "\u{E4A4}", // Tenuto above
  articTenutoStaccatoAbove: "\u{E4B2}", // Louré (tenuto-staccato) above
  augmentationDot: "\u{E1E7}", // Augmentation dot
  barlineDouble: "\u{E031}", // Double barline
  barlineFinal: "\u{E032}", // Final barline
  barlineSingle: "\u{E030}", // Single barline
  brace: "\u{E000}", // Brace
  bracket: "\u{E002}", // Bracket
  breathMarkComma: "\u{E4CE}", // Breath mark (comma)
  cClef: "\u{E05C}", // C clef
  caesura: "\u{E4D1}", // Caesura
  coda: "\u{E048}", // Coda
  daCapo: "\u{E046}", // Da capo
  dalSegno: "\u{E045}", // Dal segno
  dynamicCrescendoHairpin: "\u{E53E}", // Crescendo
  dynamicDiminuendoHairpin: "\u{E53F}", // Diminuendo
  dynamicFF: "\u{E52F}", // ff
  dynamicFFF: "\u{E530}", // fff
  dynamicForte: "\u{E522}", // Forte
  dynamicFortePiano: "\u{E534}", // Forte-piano
  dynamicMF: "\u{E52D}", // mf
  dynamicMP: "\u{E52C}", // mp
  dynamicNiente: "\u{E526}", // Niente
  dynamicPP: "\u{E52B}", // pp
  dynamicPPP: "\u{E52A}", // ppp
  dynamicPiano: "\u{E520}", // Piano
  dynamicSforzato: "\u{E539}", // Sforzato
  fClef: "\u{E062}", // F clef
  fermataAbove: "\u{E4C0}", // Fermata above
  fingering1: "\u{ED11}", // Fingering 1 (thumb)
  fingering2: "\u{ED12}", // Fingering 2 (index finger)
  fingering3: "\u{ED13}", // Fingering 3 (middle finger)
  fingering4: "\u{ED14}", // Fingering 4 (ring finger)
  fingering5: "\u{ED15}", // Fingering 5 (little finger)
  gClef: "\u{E050}", // G clef
  gClef8vb: "\u{E052}", // G clef ottava bassa
  graceNoteAcciaccaturaStemUp: "\u{E560}", // Slashed grace note stem up
  graceNoteAppoggiaturaStemUp: "\u{E562}", // Grace note stem up
  keyboardPedalHalf: "\u{E656}", // Half-pedal mark
  keyboardPedalPed: "\u{E650}", // Pedal mark
  keyboardPedalSost: "\u{E659}", // Sostenuto pedal mark
  keyboardPedalUp: "\u{E655}", // Pedal up mark
  legerLine: "\u{E022}", // Leger line
  metNoteQuarterUp: "\u{ECA5}", // Quarter note (crotchet) stem up
  note16thUp: "\u{E1D9}", // 16th note (semiquaver) stem up
  note32ndUp: "\u{E1DB}", // 32nd note (demisemiquaver) stem up
  note64thUp: "\u{E1DD}", // 64th note (hemidemisemiquaver) stem up
  note8thUp: "\u{E1D7}", // Eighth note (quaver) stem up
  noteDoubleWhole: "\u{E1D0}", // Double whole note (breve)
  noteHalfUp: "\u{E1D3}", // Half note (minim) stem up
  noteQuarterUp: "\u{E1D5}", // Quarter note (crotchet) stem up
  noteWhole: "\u{E1D2}", // Whole note (semibreve)
  ornamentMordent: "\u{E56D}", // Mordent
  ornamentShortTrill: "\u{E56C}", // Short trill
  ornamentTrill: "\u{E566}", // Trill
  ornamentTurn: "\u{E567}", // Turn
  ornamentTurnInverted: "\u{E568}", // Inverted turn
  ottavaAlta: "\u{E511}", // Ottava alta
  ottavaBassaVb: "\u{E51C}", // Ottava bassa (8vb)
  quindicesimaAlta: "\u{E515}", // Quindicesima alta
  repeat1Bar: "\u{E500}", // Repeat last bar
  repeat2Bars: "\u{E501}", // Repeat last two bars
  repeatLeft: "\u{E040}", // Left (start) repeat sign
  repeatRight: "\u{E041}", // Right (end) repeat sign
  rest16th: "\u{E4E7}", // 16th (semiquaver) rest
  rest32nd: "\u{E4E8}", // 32nd (demisemiquaver) rest
  rest64th: "\u{E4E9}", // 64th (hemidemisemiquaver) rest
  rest8th: "\u{E4E6}", // Eighth (quaver) rest
  restHBar: "\u{E4EE}", // Multiple measure rest
  restHalf: "\u{E4E4}", // Half (minim) rest
  restQuarter: "\u{E4E5}", // Quarter (crotchet) rest
  restWhole: "\u{E4E3}", // Whole (semibreve) rest
  segno: "\u{E047}", // Segno
  staff5Lines: "\u{E014}", // 5-line staff
  timeSigCommon: "\u{E08A}", // Common time
  timeSigCutCommon: "\u{E08B}", // Cut time
  tremolo1: "\u{E220}", // Combining tremolo 1
  tuplet3: "\u{E883}", // Tuplet 3
  unpitchedPercussionClef1: "\u{E069}", // Unpitched percussion clef 1
  wiggleGlissando: "\u{EAAF}", // Glissando wiggle segment
};

export function smufl(name: string): string {
  const cp = SMUFL[name];
  if (!cp) throw new Error(`Glifo SMuFL no incluido: ${name}. Ejecuta bun run gen:smufl`);
  return cp;
}
