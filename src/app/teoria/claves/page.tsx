import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { Glyph } from "@/components/notation/glyph";
import { PlayButton } from "@/components/audio/play-button";

export const metadata = { title: "Las claves" };

export default function Page() {
  return (
    <LessonLayout slug="claves">
      <Section title="¿Para qué sirve la clave?">
        <P>
          El pentagrama por sí solo no dice qué nota es cada línea. La <strong>clave</strong> es el símbolo
          que se escribe al principio y que fija el nombre de <em>una</em> línea; a partir de ella se deducen
          todas las demás. Cambiar de clave cambia el nombre de todas las posiciones.
        </P>
        <div className="grid grid-cols-3 gap-3">
          {[
            { g: "gClef", n: "Clave de sol" },
            { g: "fClef", n: "Clave de fa" },
            { g: "cClef", n: "Clave de do" },
          ].map((c) => (
            <div key={c.g} className="card p-4 flex flex-col items-center gap-2">
              <Glyph name={c.g} size={64} label={c.n} />
              <span className="text-sm font-medium text-center">{c.n}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Clave de sol">
        <P>
          La clave de sol <Glyph name="gClef" inline size={26} /> se dibuja empezando en la{" "}
          <strong>segunda línea</strong>, a la que da el nombre de <strong>sol</strong> (sol4). Es la clave de
          los sonidos agudos: en el piano la lee normalmente la <strong>mano derecha</strong>.
        </P>
        <Figure caption="Líneas en clave de sol: mi – sol – si – re – fa.">
          <Score measures={["E4/w, G4, B4, D5, F5"]} labels={["mi", "sol", "si", "re", "fa"]} width={520} />
        </Figure>
        <Figure caption="Espacios en clave de sol: fa – la – do – mi.">
          <Score measures={["F4/w, A4, C5, E5"]} labels={["fa", "la", "do", "mi"]} width={520} />
        </Figure>
        <Callout kind="tip" title="Trucos para recordar">
          Líneas: «<strong>Mi Sol</strong>o <strong>Si</strong>empre <strong>Re</strong>ga <strong>Fa</strong>voritos».
          Espacios: <strong>FA-LA-DO-MI</strong> (en inglés forman la palabra FACE).
        </Callout>
      </Section>

      <Section title="Clave de fa">
        <P>
          La clave de fa <Glyph name="fClef" inline size={26} /> tiene dos puntos que abrazan la{" "}
          <strong>cuarta línea</strong>: esa línea es <strong>fa</strong> (fa3). Es la clave de los sonidos
          graves: la <strong>mano izquierda</strong> del piano.
        </P>
        <Figure caption="Líneas en clave de fa: sol – si – re – fa – la.">
          <Score clef="bass" measures={["G2/w, B2, D3, F3, A3"]} labels={["sol", "si", "re", "fa", "la"]} width={520} />
        </Figure>
        <Figure caption="Espacios en clave de fa: la – do – mi – sol.">
          <Score clef="bass" measures={["A2/w, C3, E3, G3"]} labels={["la", "do", "mi", "sol"]} width={520} />
        </Figure>
        <Callout kind="warn">
          La misma posición significa notas distintas según la clave: la segunda línea es <strong>sol</strong>{" "}
          en clave de sol pero <strong>si</strong> en clave de fa. Mira siempre la clave antes de leer.
        </Callout>
      </Section>

      <Section title="Clave de do">
        <P>
          La clave de do <Glyph name="cClef" inline size={26} /> señala con su centro la línea del{" "}
          <strong>do central</strong> (do4). Puede colocarse en distintas líneas: en la tercera se llama{" "}
          <em>clave de contralto</em> (viola) y en la cuarta, <em>clave de tenor</em> (violonchelo, fagot,
          trombón agudos). En el piano no se usa, pero conviene reconocerla.
        </P>
        <Figure caption="Clave de do en tercera línea (contralto): la línea central es do4.">
          <Score clef="alto" measures={["F3/w, A3, C4, E4, G4"]} labels={["fa", "la", "do", "mi", "sol"]} width={520} />
        </Figure>
      </Section>

      <Section title="El gran pentagrama del piano">
        <P>
          El piano abarca tanto graves como agudos, así que usa <strong>dos pentagramas</strong> unidos por
          una llave <Glyph name="brace" inline size={26} />: el superior en clave de sol (mano derecha) y el
          inferior en clave de fa (mano izquierda). Este conjunto se llama <strong>sistema</strong> o{" "}
          <em>gran pentagrama</em>.
        </P>
        <Figure caption="El do central se escribe justo entre los dos pentagramas: con línea adicional debajo en clave de sol o encima en clave de fa. Es la misma tecla.">
          <Score
            measures={["C4/w"]}
            bassMeasures={["C4/w"]}
            labels={["do4 (mano derecha)"]}
            bassLabels={["do4 (mano izquierda)"]}
            width={420}
          />
        </Figure>
        <P>
          Imagina el gran pentagrama como once líneas seguidas en las que la línea central (la del do) se ha
          borrado. Así, las notas continúan sin saltos de un pentagrama al otro.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Escala de do a dos manos: la izquierda sube hasta el do central y la derecha continúa.</span>
              <PlayButton
                events={[48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72].map((m) => ({ midis: [m], beats: 0.5 }))}
                bpm={90}
                size="sm"
              />
            </span>
          }
        >
          <Score
            time="4/4"
            measures={["B4/w/r", "D4/q, E4, F4, G4", "A4/q, B4, C5/h"]}
            bassMeasures={["C3/q, D3, E3, F3", "G3/q, A3, B3, C4", "B3/w/r"]}
            width={620}
            endBar="end"
          />
        </Figure>
        <Callout kind="info" title="Resumen">
          <ul className="list-disc pl-4 space-y-1">
            <li>Clave de sol: segunda línea = sol4. Mano derecha.</li>
            <li>Clave de fa: cuarta línea = fa3. Mano izquierda.</li>
            <li>Clave de do: la línea señalada = do4. Viola, violonchelo, fagot.</li>
            <li>El piano usa los dos pentagramas unidos por una llave; el do central está en medio.</li>
          </ul>
        </Callout>
      </Section>
    </LessonLayout>
  );
}
