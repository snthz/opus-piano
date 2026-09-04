import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { PlayButton } from "@/components/audio/play-button";
import { ScaleExplorer } from "@/components/notation/scale-explorer";
import { INTERVALS, CHORDS, DEGREE_NAMES, ROMAN } from "@/lib/music/scales";

export const metadata = { title: "Escalas, intervalos y acordes" };

const C4 = 60;

export default function Page() {
  const dyads = INTERVALS.slice(0, 8);
  const dyads2 = INTERVALS.slice(8);
  return (
    <LessonLayout slug="escalas">
      <Section title="La escala mayor">
        <P>
          Una <strong>escala</strong> es una serie ordenada de notas que sube de la tónica a su octava. La
          escala <strong>mayor</strong> sigue siempre el mismo patrón de tonos (T) y semitonos (S):{" "}
          <strong>T T S T T T S</strong>. En Do mayor son solo teclas blancas: los semitonos caen entre mi–fa
          y si–do.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Do mayor con los grados en números romanos.</span>
              <PlayButton events={[0, 2, 4, 5, 7, 9, 11, 12].map((s) => ({ midis: [C4 + s], beats: 0.5 }))} bpm={100} size="sm" />
            </span>
          }
        >
          <Score measures={["C4/q, D4, E4, F4", "G4/q, A4, B4, C5"]} time="4/4" labels={[...ROMAN, "I"]} width={520} endBar="end" />
        </Figure>
        <div className="card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-3 text-left">
              <tr>
                <th className="font-medium py-1">Grado</th>
                <th className="font-medium">Nombre</th>
                <th className="font-medium">En Do mayor</th>
              </tr>
            </thead>
            <tbody>
              {DEGREE_NAMES.map((d, i) => (
                <tr key={d} className="border-t border-line">
                  <td className="py-1.5 font-semibold">{ROMAN[i]}</td>
                  <td>{d}</td>
                  <td className="text-ink-2">{["do", "re", "mi", "fa", "sol", "la", "si"][i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          Las notas más importantes son la <strong>tónica</strong> (I, el «hogar»), la{" "}
          <strong>dominante</strong> (V, la que más tensión crea hacia la tónica) y la{" "}
          <strong>subdominante</strong> (IV). La <strong>sensible</strong> (VII) está a un semitono de la
          tónica y «pide» resolver en ella.
        </P>
      </Section>

      <Section title="Las escalas menores">
        <P>
          La escala <strong>menor natural</strong> usa las mismas notas que su relativa mayor pero empieza
          en el sexto grado: la menor son las teclas blancas desde la. Su patrón es{" "}
          <strong>T S T T S T T</strong>. Para que el 7.º grado atraiga más hacia la tónica se sube medio tono
          y nace la <strong>menor armónica</strong>; si además se sube el 6.º al subir, la{" "}
          <strong>menor melódica</strong>.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>la menor natural, armónica y melódica.</span>
              <PlayButton events={[0, 2, 3, 5, 7, 8, 10, 12].map((s) => ({ midis: [57 + s], beats: 0.4 }))} bpm={100} size="sm" label="Natural" />
              <PlayButton events={[0, 2, 3, 5, 7, 8, 11, 12].map((s) => ({ midis: [57 + s], beats: 0.4 }))} bpm={100} size="sm" label="Armónica" />
              <PlayButton events={[0, 2, 3, 5, 7, 9, 11, 12].map((s) => ({ midis: [57 + s], beats: 0.4 }))} bpm={100} size="sm" label="Melódica" />
            </span>
          }
        >
          <Score measures={["A3/8, B3, C4, D4, E4, F4, G4, A4"]} time="4/4" labels={["la", "si", "do", "re", "mi", "fa", "sol", "la"]} width={520} />
          <Score measures={["A3/8, B3, C4, D4, E4, F4, G#4, A4"]} time="4/4" labels={["", "", "", "", "", "", "sol♯", ""]} width={520} className="mt-1" />
          <Score measures={["A3/8, B3, C4, D4, E4, F#4, G#4, A4"]} time="4/4" labels={["", "", "", "", "", "fa♯", "sol♯", ""]} width={520} className="mt-1" />
        </Figure>
      </Section>

      <Section title="Explora cualquier escala">
        <ScaleExplorer />
      </Section>

      <Section title="Intervalos">
        <P>
          Un <strong>intervalo</strong> es la distancia entre dos notas. Se nombra por el número de grados que
          abarca (segunda, tercera, cuarta…) y por su calidad (mayor, menor, justa, aumentada, disminuida). La
          forma más práctica de reconocerlos es asociarlos a canciones conocidas.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Intervalos desde do4, del unísono a la quinta justa.</span>
              <PlayButton events={dyads.map((i) => ({ midis: [C4, C4 + i.semitones], beats: 1 }))} bpm={80} size="sm" />
            </span>
          }
        >
          <Score measures={[dyads.map((i) => `(C4 ${["C4", "Db4", "D4", "Eb4", "E4", "F4", "Gb4", "G4"][i.semitones]})/q`).join(", ")]} time="8/4" labels={dyads.map((i) => i.short)} width={600} />
        </Figure>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>De la sexta menor a la octava.</span>
              <PlayButton events={dyads2.map((i) => ({ midis: [C4, C4 + i.semitones], beats: 1 }))} bpm={80} size="sm" />
            </span>
          }
        >
          <Score measures={[dyads2.map((i) => `(C4 ${["Ab4", "A4", "Bb4", "B4", "C5"][i.semitones - 8]})/q`).join(", ")]} time="5/4" labels={dyads2.map((i) => i.short)} width={420} />
        </Figure>
        <div className="card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-3 text-left">
              <tr>
                <th className="font-medium py-1">Intervalo</th>
                <th className="font-medium text-center">Semitonos</th>
                <th className="font-medium">Para reconocerlo</th>
              </tr>
            </thead>
            <tbody>
              {INTERVALS.map((i) => (
                <tr key={i.short} className="border-t border-line">
                  <td className="py-1.5">
                    <span className="font-semibold">{i.name}</span> <span className="text-ink-3">{i.short}</span>
                  </td>
                  <td className="text-center tabular-nums">{i.semitones}</td>
                  <td className="text-ink-2">{i.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Acordes básicos">
        <P>
          Un <strong>acorde</strong> son tres o más notas que suenan a la vez. Las <strong>tríadas</strong>{" "}
          se construyen apilando terceras sobre una nota <em>fundamental</em>: fundamental, tercera y quinta.
          Según sean esas terceras mayores o menores, el acorde es mayor, menor, disminuido o aumentado.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Do mayor, do menor, do disminuido, do aumentado, Do7 y Domaj7.</span>
              <PlayButton
                events={CHORDS.slice(0, 6).map((c) => ({ midis: c.intervals.map((s) => C4 + s), beats: 1.5 }))}
                bpm={80}
                size="sm"
              />
            </span>
          }
        >
          <Score
            measures={["(C4 E4 G4)/w", "(C4 Eb4 G4)/w", "(C4 Eb4 Gb4)/w", "(C4 E4 G#4)/w", "(C4 E4 G4 Bb4)/w", "(C4 E4 G4 B4)/w"]}
            labels={["Do", "Dom", "Do°", "Do+", "Do7", "Domaj7"]}
            width={640}
          />
        </Figure>
        <div className="grid gap-3">
          {CHORDS.map((c) => (
            <div key={c.id} className="card p-4 flex items-center gap-4">
              <span className="w-16 shrink-0 text-center font-bold text-lg">Do{c.suffix}</span>
              <span>
                <span className="block font-semibold">{c.name}</span>
                <span className="block text-sm text-ink-2">{c.description}</span>
              </span>
            </div>
          ))}
        </div>
        <Callout kind="tip" title="Acordes de una tonalidad">
          Construyendo una tríada sobre cada grado de la escala mayor se obtienen los acordes de la tonalidad:{" "}
          <strong>I</strong> mayor, <strong>ii</strong> menor, <strong>iii</strong> menor, <strong>IV</strong>{" "}
          mayor, <strong>V</strong> mayor, <strong>vi</strong> menor y <strong>vii°</strong> disminuido. Miles de
          canciones usan solo I, IV, V y vi.
        </Callout>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Progresión I – V – vi – IV en Do mayor.</span>
              <PlayButton
                events={[
                  { midis: [60, 64, 67], beats: 2 },
                  { midis: [59, 62, 67], beats: 2 },
                  { midis: [60, 64, 69], beats: 2 },
                  { midis: [60, 65, 69], beats: 2 },
                ]}
                bpm={90}
                size="sm"
              />
            </span>
          }
        >
          <Score measures={["(C4 E4 G4)/h, (B3 D4 G4)/h", "(C4 E4 A4)/h, (C4 F4 A4)/h"]} time="4/4" labels={["I", "V", "vi", "IV"]} width={520} endBar="end" />
        </Figure>
      </Section>
    </LessonLayout>
  );
}
