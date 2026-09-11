"use client";

import type { ChatTurn } from "@/lib/study-plan";

/**
 * The conversation with the teacher, kept per thread in localStorage: a
 * reload (or a walk to another page and back) finds the same thread, and each
 * score keeps its own, so what was asked about one piece never shows up under
 * another.
 *
 * For a tutor, remembering is half of it: a chat that starts blank every time
 * can't be asked "and what you told me yesterday?", and the student can't
 * reread the answer they got.
 *
 * Only the device stores it. It's a study aid, not a document to sync, and
 * the answers already depend on a plan that lives on the same device.
 */

/** The teacher that isn't about any score in particular (`/teacher`). */
export const GENERAL_THREAD = "general";

const key = (threadId: string) => `etude:chat:${threadId}`;

/** Enough to remember the session; far more than the prompt sends back. */
const MAX_TURNS = 40;
/** Guard on the storage quota: a long chat is trimmed from the oldest end. */
const MAX_CHARS = 40_000;

function trim(turns: ChatTurn[]): ChatTurn[] {
  // an answer that hadn't started when this was saved: the question stays, the empty turn goes,
  // or it would come back as typing dots that never finish
  const settled = turns[turns.length - 1]?.content ? turns : turns.slice(0, -1);
  const kept = settled.slice(-MAX_TURNS);
  let chars = kept.reduce((n, t) => n + t.content.length, 0);
  while (kept.length > 1 && chars > MAX_CHARS) {
    chars -= kept[0].content.length;
    kept.shift();
  }
  return kept;
}

export function readChat(threadId: string): ChatTurn[] {
  try {
    const raw = localStorage.getItem(key(threadId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is ChatTurn =>
        !!t && typeof t === "object" && typeof (t as ChatTurn).content === "string" && ((t as ChatTurn).role === "user" || (t as ChatTurn).role === "assistant"),
    );
  } catch {
    return [];
  }
}

export function writeChat(threadId: string, turns: ChatTurn[]) {
  try {
    if (turns.length) localStorage.setItem(key(threadId), JSON.stringify(trim(turns)));
    else localStorage.removeItem(key(threadId));
  } catch {
    /* no storage, or full: the chat still works for this visit */
  }
}

export function clearChat(threadId: string) {
  try {
    localStorage.removeItem(key(threadId));
  } catch {
    /* no storage available */
  }
}
