ALTER TYPE "public"."notification_type" ADD VALUE 'APPROVAL_OVERDUE';--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "reminded_at" timestamp with time zone;