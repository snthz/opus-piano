-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastPlayed" TIMESTAMP(3),

    CONSTRAINT "ExerciseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_code_key" ON "Profile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseProgress_profileId_exerciseId_key" ON "ExerciseProgress"("profileId", "exerciseId");

-- CreateIndex
CREATE INDEX "DailyActivity_profileId_day_idx" ON "DailyActivity"("profileId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_profileId_exerciseId_day_key" ON "DailyActivity"("profileId", "exerciseId", "day");

-- AddForeignKey
ALTER TABLE "ExerciseProgress" ADD CONSTRAINT "ExerciseProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
