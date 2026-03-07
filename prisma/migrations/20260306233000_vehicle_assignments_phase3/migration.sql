-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('scheduled', 'active', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "VehicleAssignment" (
    "id" UUID NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "assigned_to_user_id" UUID NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'scheduled',
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleAssignment_vehicle_id_start_at_end_at_idx" ON "VehicleAssignment"("vehicle_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "VehicleAssignment_assigned_to_user_id_idx" ON "VehicleAssignment"("assigned_to_user_id");

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
