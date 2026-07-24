-- Add roleId column to Account (nullable for migration)
ALTER TABLE "Account" ADD COLUMN "roleId" TEXT;

-- Backfill roleId from existing role enum
UPDATE "Account" SET "roleId" = 'ADMIN' WHERE "role" = 'ADMIN';
UPDATE "Account" SET "roleId" = 'USER' WHERE "role" = 'USER';
UPDATE "Account" SET "roleId" = 'CASHIER' WHERE "role" = 'CASHIER';

-- Make roleId NOT NULL and set default
ALTER TABLE "Account" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "Account" ALTER COLUMN "roleId" SET DEFAULT 'USER';

-- Drop old role column to remove dependency on Role enum
ALTER TABLE "Account" DROP COLUMN "role";

-- Drop the Role enum type
DROP TYPE "Role";

-- Create Role table
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- Seed default roles
INSERT INTO "Role" ("id", "name", "description", "isSystem", "permissions", "createdAt", "updatedAt") VALUES
  ('ADMIN', 'Administrator', 'Full system access with all permissions', true, '{"canManageUsers": true, "canManageMovies": true, "canManageBookings": true}', NOW(), NOW()),
  ('USER', 'Customer', 'Standard user account', true, '{"canManageUsers": false, "canManageMovies": false, "canManageBookings": false}', NOW(), NOW()),
  ('CASHIER', 'Cashier', 'Point of sale operator', true, '{"canManageUsers": false, "canManageMovies": false, "canManageBookings": true}', NOW(), NOW());

-- Add foreign key constraint
ALTER TABLE "Account" ADD CONSTRAINT "Account_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create SystemSetting table
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);