CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" varchar(200) NOT NULL,
	"action" varchar(50) NOT NULL,
	"target_type" varchar(30) NOT NULL,
	"target_id" text,
	"summary" varchar(500) NOT NULL,
	"changes" jsonb,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_index" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_index" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_type_target_id_index" ON "audit_logs" USING btree ("target_type","target_id");