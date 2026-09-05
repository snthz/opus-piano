import { z } from "zod";
import { prisma } from "@/lib/db";
import { isScoreId } from "@/lib/server/score-files";

/** Lo que el cliente ve de cada partitura (sin archivos). */
export interface ScoreMeta {
  id: string;
  name: string;
  kind: "pdf" | "musicxml";
  notes: string;
  pageCount: number;
  thumbnail: string;
  annotations: unknown;
  size: number;
  uploaded: boolean;
  hasXml: boolean;
  createdAt: number;
  updatedAt: number;
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
  createdAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive(),
});

export const scorePatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  notes: z.string().max(20_000).optional(),
  annotations: annotationsSchema.nullable().optional(),
  updatedAt: z.number().int().positive(),
});

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
    size: r.size,
    uploaded: r.uploaded,
    hasXml: r.xmlSize > 0,
    createdAt: r.createdAt.getTime(),
    updatedAt: Number(r.updatedAt),
  };
}

export async function usedBytes(userId: string): Promise<number> {
  const agg = await prisma.score.aggregate({ where: { userId }, _sum: { size: true, xmlSize: true } });
  return (agg._sum.size ?? 0) + (agg._sum.xmlSize ?? 0);
}
