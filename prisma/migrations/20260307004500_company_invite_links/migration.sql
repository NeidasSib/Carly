-- CreateTable
CREATE TABLE "CompanyInvite" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL DEFAULT 'member',
    "created_by" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_user_id" UUID,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvite_token_key" ON "CompanyInvite"("token");

-- CreateIndex
CREATE INDEX "CompanyInvite_company_id_idx" ON "CompanyInvite"("company_id");

-- CreateIndex
CREATE INDEX "CompanyInvite_token_idx" ON "CompanyInvite"("token");

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
