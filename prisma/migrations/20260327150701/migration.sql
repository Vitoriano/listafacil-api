/*
  Warnings:

  - A unique constraint covering the columns `[google_place_id]` on the table `stores` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "google_place_id" VARCHAR(300);

-- CreateIndex
CREATE UNIQUE INDEX "stores_google_place_id_key" ON "stores"("google_place_id");
