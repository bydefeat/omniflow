-- G5: one delegator cannot have two ACTIVE delegations with overlapping time ranges.
-- Drizzle cannot declare EXCLUDE constraints, so this migration is hand-written.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_no_overlap"
  EXCLUDE USING gist ("delegator_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" = 'ACTIVE');
