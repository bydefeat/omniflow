ALTER TYPE "public"."approval_result" ADD VALUE 'RETURNED' BEFORE 'CANCELLED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'REQUEST_RETURNED';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE 'NEEDS_INFO' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_requestId_stepOrder_unique";--> statement-breakpoint
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_reject_needs_comment";--> statement-breakpoint
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_decided_fields";--> statement-breakpoint
CREATE INDEX "approvals_request_id_step_order_index" ON "approvals" USING btree ("request_id","step_order");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_one_waiting_per_request" ON "approvals" USING btree ("request_id") WHERE "approvals"."result" = 'WAITING';--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reject_needs_comment" CHECK ("approvals"."result"::text not in ('REJECTED', 'RETURNED') or "approvals"."comment" is not null);--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_fields" CHECK (("approvals"."result"::text in ('APPROVED', 'REJECTED', 'RETURNED')) = ("approvals"."acted_by_id" is not null and "approvals"."decided_at" is not null));