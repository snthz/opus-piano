import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TooLargeError, fileSize, isScoreId, readStream, removeFiles, writeUpload } from "@/lib/server/score-files";

const user = "user1abc";
const id = "123e4567-e89b-42d3-a456-426614174000";
let dir = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "opus-scores-"));
  process.env.SCORES_DIR = dir;
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const stream = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
      c.close();
    },
  });

describe("archivos de partituras en disco", () => {
  test("escribe en streaming, cuenta bytes y se puede volver a leer", async () => {
    const size = await writeUpload(user, id, "file", stream(["hola ", "mundo"]), 1024);
    expect(size).toBe(10);
    expect(await fileSize(user, id, "file")).toBe(10);
    const s = await readStream(user, id, "file");
    expect(s).not.toBeNull();
    expect(await new Response(s!).text()).toBe("hola mundo");
  });

  test("corta y no deja nada si supera el límite", async () => {
    await expect(writeUpload(user, id, "xml", stream(["x".repeat(600), "y".repeat(600)]), 1000)).rejects.toBeInstanceOf(TooLargeError);
    expect(await fileSize(user, id, "xml")).toBeNull();
  });

  test("borra los dos archivos de una partitura", async () => {
    await writeUpload(user, id, "xml", stream(["<score/>"]), 1000);
    await removeFiles(user, id);
    expect(await fileSize(user, id, "file")).toBeNull();
    expect(await fileSize(user, id, "xml")).toBeNull();
  });

  test("ids fuera del formato UUID no llegan al disco", async () => {
    expect(isScoreId("../../etc/passwd")).toBe(false);
    await expect(writeUpload(user, "../x", "file", stream(["a"]), 10)).rejects.toThrow();
  });
});
