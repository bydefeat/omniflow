CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_no_overlap"
  EXCLUDE USING gist ("delegator_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" = 'ACTIVE');
