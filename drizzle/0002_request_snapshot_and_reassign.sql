ALTER TABLE "approvals" ADD COLUMN "reassigned_by_id" text;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "reassigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reassigned_by_id_user_id_fk" FOREIGN KEY ("reassigned_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "requests" r SET "snapshot" = jsonb_build_object(
  'formSchema', t."form_schema",
  'hasLineItems', t."has_line_items",
  'slaHours', t."sla_hours",
  'steps', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'stepOrder', s."step_order",
      'name', s."name",
      'approverType', s."approver_type",
      'approverRole', s."approver_role"
    ) ORDER BY s."step_order")
    FROM "approval_steps" s
    WHERE s."request_type_id" = t."id"
  ), '[]'::jsonb)
)
FROM "request_types" t
WHERE t."id" = r."request_type_id" AND r."status" <> 'DRAFT';--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_snapshot_after_submit" CHECK (("requests"."status" = 'DRAFT') = ("requests"."snapshot" is null));