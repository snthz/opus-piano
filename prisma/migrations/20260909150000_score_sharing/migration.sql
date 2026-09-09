-- Partituras compartidas: visibilidad por partitura y texto público. Notas, trazos y plan siguen siendo privados.

-- AlterTable
ALTER TABLE "Score" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private',
ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN "sharedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Score_visibility_sharedAt_idx" ON "Score"("visibility", "sharedAt");
