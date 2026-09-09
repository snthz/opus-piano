"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { openAuthModal } from "@/lib/auth-modal";
import { exercisePath, lessonPath } from "@/lib/routes";
import { useSettings } from "@/lib/settings";
import { splitTeacherRefs, type ChatTurn } from "@/lib/study-plan";
import { askGeneralTeacher, teacherAvailable } from "@/lib/teacher-client";
import { MAX_QUESTION_CHARS } from "@/lib/teacher";
import { isAbort, UserError } from "@/lib/user-error";
import { ArrowIcon } from "@/components/ui/arrow-icon";

/**
 * El chat con el profesor general. Conoce las lecciones, los ejercicios y el
 * glosario de la app, así que sus respuestas acaban en un enlace a donde
 * seguir: eso es lo que lo hace distinto de abrir cualquier otro chat.
 *
 * Pide cuenta porque cada pregunta la paga el servidor, igual que el análisis
 * de una partitura.
 */

const SUGGESTIONS = [
  "¿Para qué sirve la armadura?",
  "¿Cómo sé qué dedo poner en cada nota?",
  "Me pierdo leyendo la clave de fa, ¿qué hago?",
  "¿Cuánto debería practicar al día?",
];

export function TeacherChat() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    teacherAvailable().then(setAvailable, () => setAvailable(false));
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  const ask = async () => {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setError(null);
    setBusy(true);
    const history: ChatTurn[] = [...turns, { role: "user", content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    const ac = new AbortController();
    abort.current = ac;
    try {
      await askGeneralTeacher({
        naming: settings.naming,
        history,
        signal: ac.signal,
        onDelta: (t) =>
          setTurns((prev) => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: last.content + t }];
          }),
      });
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof UserError ? e.message : "No se pudo obtener respuesta.");
      // Una respuesta a medias se queda; una que no llegó a empezar se retira.
      setTurns((prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
    } finally {
      if (abort.current === ac) abort.current = null;
      setBusy(false);
    }
  };

  if (available === false) {
    return (
      <p className="card p-5 text-sm leading-relaxed text-ink-2">
        El profesor no está disponible en este servidor ahora mismo. El resto de la app funciona igual: la{" "}
        <Link href="/path" className="font-semibold text-ink hover:underline">
          ruta
        </Link>{" "}
        y el{" "}
        <Link href="/glossary" className="font-semibold text-ink hover:underline">
          glosario
        </Link>{" "}
        responden a casi todo sin necesidad de preguntar.
      </p>
    );
  }

  if (!user) {
    return (
      <div className="card p-5">
        <p className="text-sm leading-relaxed text-ink-2">
          El profesor necesita una cuenta: cada respuesta la paga el servidor, y así puede repartirse entre todos.
        </p>
        <button type="button" onClick={() => openAuthModal()} className="pill pill-active mt-4">
          Entrar o crear una cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {turns.length > 0 && (
        <div className="space-y-2">
          {turns.map((t, i) => (
            <div
              key={i}
              className={`rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                t.role === "user" ? "ml-8 bg-ink text-bg" : "mr-4 card"
              }`}
            >
              {t.role === "assistant" ? <Answer text={t.content} /> : <span className="whitespace-pre-wrap">{t.content}</span>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => setQuestion(s)} className="pill text-xs">
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="px-1 text-xs text-bad">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_CHARS))}
          placeholder="Pregunta lo que quieras de música…"
          disabled={busy}
          className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 text-sm shadow-[var(--shadow)] focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        />
        {busy ? (
          <button type="button" onClick={() => abort.current?.abort()} className="pill shrink-0">
            Parar
          </button>
        ) : (
          <button type="submit" disabled={!question.trim()} className="pill pill-active shrink-0 disabled:opacity-50">
            Enviar
            <ArrowIcon className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}

/** La respuesta con sus citas convertidas en enlaces a las páginas de la app. */
function Answer({ text }: { text: string }) {
  if (!text) return <span className="animate-pulse">…</span>;
  return (
    <>
      {splitTeacherRefs(text).map((part, i) =>
        part.type === "text" ? (
          <span key={i} className="whitespace-pre-wrap">
            {part.text}
          </span>
        ) : (
          <Link
            key={i}
            href={part.ref.kind === "lesson" ? lessonPath(part.ref.slug) : exercisePath(part.ref.id)}
            className="font-semibold text-ink underline decoration-ink-3 underline-offset-2 hover:decoration-ink"
          >
            {part.ref.title}
          </Link>
        ),
      )}
    </>
  );
}
