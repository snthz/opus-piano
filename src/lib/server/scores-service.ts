import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isScoreId } from "@/lib/server/score-files";
import { isScoreStatus, SCORE_STATUSES, type ScoreStatus } from "@/lib/score-status";
import { planStateSchema } from "@/lib/study-plan";

/** Lo que el cliente ve de cada partitura (sin archivos). */
export interface ScoreMeta {
  id: string;
  name: string;
  kind: "pdf" | "musicxml";
  notes: string;
  pageCount: number;
  thumbnail: string;
  annotations: unknown;
  /** Plan de estudio (planStateSchema) o undefined */
  plan: unknown;
  /** Null si el dispositivo nunca lo ha fijado (partituras anteriores al campo). */
  status: ScoreStatus | null;
  size: number;
  uploaded: boolean;
  hasXml: boolean;
  visibility: Visibility;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export const VISIBILITIES = ["private", "link", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const visibilitySchema = z.enum(VISIBILITIES);
/** Null = el dispositivo no lo sabe; se guarda como cadena vacía y vuelve como null. */
const statusSchema = z.enum(SCORE_STATUSES).nullable();
/** Lo que acompaña a una partitura compartida; corto a propósito, es una presentación, no un ensayo. */
export const DESCRIPTION_MAX = 600;

/**
 * Lo que ve cualquiera de una partitura compartida: el archivo (por sus
 * rutas), el nombre, la portada y la presentación. Notas, trazos y plan de
 * estudio son del dueño y no salen de aquí.
 */
export interface SharedScoreMeta {
  id: string;
  name: string;
  kind: "pdf" | "musicxml";
  pageCount: number;
  thumbnail: string;
  description: string;
  /** Suena: es MusicXML o tiene uno vinculado. */
  playable: boolean;
  hasXml: boolean;
  visibility: Visibility;
  owner: string;
  sharedAt: number;
}

const stroke = z.object({
  color: z.string().max(32),
  width: z.number(),
  highlighter: z.boolean().optional(),
  points: z.array(z.tuple([z.number(), z.number()])).max(5000),
});
/** Trazos por página: { "1": [...], "2": [...] } */
export const annotationsSchema = z.record(z.string().regex(/^\d+$/), z.array(stroke).max(2000));

export const scoreCreateSchema = z.object({
  id: z.string().refine(isScoreId, { error: "Id no válido" }),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["pdf", "musicxml"]),
  notes: z.string().max(20_000).default(""),
  pageCount: z.number().int().min(0).max(10_000).default(0),
  // Miniatura: data URL de hasta ~200 KB.
  thumbnail: z.string().max(200_000).default(""),
  annotations: annotationsSchema.optional(),
  plan: planStateSchema.nullable().optional(),
  status: statusSchema.optional(),
  visibility: visibilitySchema.optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),
  createdAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive(),
});

export const scorePatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  notes: z.string().max(20_000).optional(),
  annotations: annotationsSchema.nullable().optional(),
  plan: planStateSchema.nullable().optional(),
  status: statusSchema.optional(),
  visibility: visibilitySchema.optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),
  updatedAt: z.number().int().positive(),
});

/** `sharedAt` se pone la primera vez que deja de ser privada (y cada vez que vuelve a serlo), para ordenar la lista. */
export function sharedAtFor(next: Visibility | undefined, previous: { visibility: string; sharedAt: Date | null } | null, now = new Date()): Date | null | undefined {
  if (next === undefined) return undefined; // no se toca
  if (next === "private") return previous?.sharedAt ?? null;
  return previous?.visibility === next && previous.sharedAt ? previous.sharedAt : now;
}

type Row = NonNullable<Awaited<ReturnType<typeof prisma.score.findFirst>>>;

export function toMeta(r: Row): ScoreMeta {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as "pdf" | "musicxml",
    notes: r.notes,
    pageCount: r.pageCount,
    thumbnail: r.thumbnail,
    annotations: r.annotations ?? undefined,
    plan: r.plan ?? undefined,
    status: isScoreStatus(r.status) ? r.status : null,
    size: r.size,
    uploaded: r.uploaded,
    hasXml: r.xmlSize > 0,
    visibility: asVisibility(r.visibility),
    description: r.description,
    createdAt: r.createdAt.getTime(),
    updatedAt: Number(r.updatedAt),
  };
}

/** Columna `status`: cadena vacía cuando el dispositivo no lo sabe; undefined = no tocar. */
export const statusColumn = (s: ScoreStatus | null | undefined): string | undefined => (s === undefined ? undefined : (s ?? ""));

const asVisibility = (v: string): Visibility => (VISIBILITIES.includes(v as Visibility) ? (v as Visibility) : "private");

export function toSharedMeta(r: Row & { user: { name: string } }): SharedScoreMeta {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as "pdf" | "musicxml",
    pageCount: r.pageCount,
    thumbnail: r.thumbnail,
    description: r.description,
    playable: r.kind === "musicxml" || r.xmlSize > 0,
    hasXml: r.xmlSize > 0,
    visibility: asVisibility(r.visibility),
    owner: r.user.name,
    sharedAt: (r.sharedAt ?? r.createdAt).getTime(),
  };
}

/** Solo lo que se ha compartido y ya tiene el archivo subido: un enlace a algo a medio subir no sirve. */
export const SHARED_WHERE: Prisma.ScoreWhereInput = { visibility: { in: ["link", "public"] }, uploaded: true };

export async function usedBytes(userId: string): Promise<number> {
  const agg = await prisma.score.aggregate({ where: { userId }, _sum: { size: true, xmlSize: true } });
  return (agg._sum.size ?? 0) + (agg._sum.xmlSize ?? 0);
}
