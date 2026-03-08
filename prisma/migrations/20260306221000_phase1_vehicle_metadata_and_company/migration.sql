CREATE TYPE "CompanyRole" AS ENUM ('owner', 'admin', 'member');


ALTER TABLE "Vehicle"
ADD COLUMN "owner_user_id" UUID,
ADD COLUMN "owner_company_id" UUID,
ADD COLUMN "vin" TEXT,
ADD COLUMN "fuel_type" TEXT,
ADD COLUMN "transmission" TEXT,
ADD COLUMN "insurance_valid_until" TIMESTAMP(3),
ADD COLUMN "inspection_valid_until" TIMESTAMP(3),
ADD COLUMN "road_tax_valid_until" TIMESTAMP(3);

UPDATE "Vehicle"
SET "owner_user_id" = "user_Id"
WHERE "owner_user_id" IS NULL;


CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "CompanyMember" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CompanyRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);


CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

CREATE INDEX "Vehicle_owner_user_id_idx" ON "Vehicle"("owner_user_id");

CREATE INDEX "Vehicle_owner_company_id_idx" ON "Vehicle"("owner_company_id");

CREATE INDEX "Company_created_by_idx" ON "Company"("created_by");


CREATE UNIQUE INDEX "CompanyMember_company_id_user_id_key" ON "CompanyMember"("company_id", "user_id");


CREATE INDEX "CompanyMember_user_id_idx" ON "CompanyMember"("user_id");

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_owner_company_id_fkey" FOREIGN KEY ("owner_company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
