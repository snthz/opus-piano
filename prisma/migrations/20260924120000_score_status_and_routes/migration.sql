-- Estado de cada partitura (por empezar, en estudio, dominada) y rutas de estudio personalizadas.

-- AlterTable
ALTER TABLE "Score" ADD COLUMN "status" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "StudyRoute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "StudyRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyRoute_userId_createdAt_idx" ON "StudyRoute"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudyRoute" ADD CONSTRAINT "StudyRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
