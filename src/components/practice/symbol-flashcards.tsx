"use client";

import { useCallback, useState } from "react";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ExerciseShell, OptionButton, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { SYMBOL_CATEGORIES, ALL_SYMBOLS, type SymbolEntry } from "@/data/symbols";
import { pickDifferent, sample, shuffle } from "@/lib/random";

type Direction = "glyph-name" | "name-glyph";

interface Question {
  target: SymbolEntry;
  options: SymbolEntry[];
}

function pool(category: string): SymbolEntry[] {
  if (category === "todos") return ALL_SYMBOLS;
  return SYMBOL_CATEGORIES.find((c) => c.id === category)?.items ?? ALL_SYMBOLS;
}

function makeQuestion(category: string, prev?: Question): Question {
  const items = pool(category);
  const target = pickDifferent(items, prev?.target, (a, b) => a.id === b.id);
  const sameCat = SYMBOL_CATEGORIES.find((c) => c.items.some((i) => i.id === target.id))?.items ?? items;
  const distractorsPool = sameCat.filter((i) => i.id !== target.id);
  let distractors = sample(distractorsPool, 3);
  if (distractors.length < 3) {
    const extra = sample(
      ALL_SYMBOLS.filter((i) => i.id !== target.id && !distractors.some((d) => d.id === i.id)),
      3 - distractors.length,
    );
    distractors = [...distractors, ...extra];
  }
  return { target, options: shuffle([target, ...distractors]) };
}

function GlyphBox({ s, size = 44 }: { s: SymbolEntry; size?: number }) {
  return <GlyphIcon name={[s.glyph, ...(s.extraGlyphs ?? [])]} size={size * (s.scale ?? 1)} fit="em" label={s.name} />;
}

export function SymbolFlashcards() {
  const { stats, answer } = useExerciseSession("simbolos");
  const [category, setCategory] = useState("todos");
  const [direction, setDirection] = useState<Direction>("glyph-name");
  const [q, setQ] = useState<Question>(() => makeQuestion("todos"));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const next = useCallback(() => {
    setQ((prev) => makeQuestion(category, prev));
    setFeedback(null);
    setChosen(null);
  }, [category]);

  const changeCategory = (c: string) => {
    setCategory(c);
    setQ(makeQuestion(c));
    setFeedback(null);
    setChosen(null);
  };

  const choose = (s: SymbolEntry) => {
    if (feedback) return;
    const correct = s.id === q.target.id;
    setChosen(s.id);
    answer(correct);
    setFeedback({
      correct,
      message: (
        <>
          <strong>{q.target.name}</strong>: {q.target.meaning}
        </>
      ),
    });
  };

  const stateFor = (s: SymbolEntry): "idle" | "correct" | "wrong" | "dim" => {
    if (!feedback) return "idle";
    if (s.id === q.target.id) return "correct";
    if (s.id === chosen) return "wrong";
    return "dim";
  };

  return (
    <ExerciseShell
      title="Símbolos"
      stats={stats}
      feedback={feedback}
      onNext={next}
      color="bg-pink"
      settings={
        <>
          <SettingRow label="Dirección">
            <Choice active={direction === "glyph-name"} onClick={() => setDirection("glyph-name")}>Símbolo → nombre</Choice>
            <Choice active={direction === "name-glyph"} onClick={() => setDirection("name-glyph")}>Nombre → símbolo</Choice>
          </SettingRow>
          <SettingRow label="Categoría">
            <Choice active={category === "todos"} onClick={() => changeCategory("todos")}>Todas</Choice>
            {SYMBOL_CATEGORIES.map((c) => (
              <Choice key={c.id} active={category === c.id} onClick={() => changeCategory(c.id)}>
                {c.title}
              </Choice>
            ))}
          </SettingRow>
        </>
      }
    >
      {direction === "glyph-name" ? (
        <>
          <p className="text-sm text-ink-2 text-center">¿Cómo se llama este símbolo?</p>
          <div className="flex justify-center">
            <div className="w-36 h-36 rounded-3xl bg-surface-2 flex items-center justify-center overflow-hidden">
              <GlyphBox s={q.target} size={64} />
            </div>
          </div>
          <div className="grid gap-2">
            {q.options.map((s) => (
              <OptionButton key={s.id} onClick={() => choose(s)} state={stateFor(s)} disabled={!!feedback} className="text-left">
                {s.name}
              </OptionButton>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-2 text-center">¿Cuál es el símbolo de…?</p>
          <p className="text-2xl font-bold text-center">{q.target.name}</p>
          <div className="grid grid-cols-2 gap-2">
            {q.options.map((s) => (
              <OptionButton key={s.id} onClick={() => choose(s)} state={stateFor(s)} disabled={!!feedback} className="h-28 flex items-center justify-center overflow-hidden">
                <GlyphBox s={s} size={48} />
              </OptionButton>
            ))}
          </div>
        </>
      )}
    </ExerciseShell>
  );
}
