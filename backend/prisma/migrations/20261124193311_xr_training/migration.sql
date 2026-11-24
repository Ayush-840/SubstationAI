-- CreateEnum
CREATE TYPE "XrMode" AS ENUM ('DESKTOP', 'VR', 'AR');

-- CreateTable
CREATE TABLE "ar_scenes" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "modelUrl" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parts" JSONB NOT NULL DEFAULT '[]',
    "zones" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ar_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_scripts" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "limits" JSONB NOT NULL DEFAULT '{"r1MinMOhm":1000,"piMin":1.5}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ar_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_steps" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "stepNo" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "value" TEXT,
    "text" TEXT NOT NULL,

    CONSTRAINT "ar_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "mode" "XrMode" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "stepsDone" INTEGER NOT NULL,
    "stepsTotal" INTEGER NOT NULL,
    "violations" JSONB NOT NULL DEFAULT '[]',
    "readings" JSONB,
    "verdict" TEXT,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ar_scenes_equipmentId_key" ON "ar_scenes"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ar_scripts_testId_key" ON "ar_scripts"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "ar_steps_scriptId_stepNo_key" ON "ar_steps"("scriptId", "stepNo");

-- CreateIndex
CREATE INDEX "training_sessions_userId_createdAt_idx" ON "training_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "training_sessions_testId_idx" ON "training_sessions"("testId");

-- AddForeignKey
ALTER TABLE "ar_scenes" ADD CONSTRAINT "ar_scenes_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_scripts" ADD CONSTRAINT "ar_scripts_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_steps" ADD CONSTRAINT "ar_steps_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "ar_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
