CREATE TABLE "request_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"revision" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"reason" text NOT NULL,
	"form_data" jsonb NOT NULL,
	"total_amount" numeric(18, 2),
	"items" jsonb NOT NULL,
	"attachments" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "removed_by_id" text;--> statement-breakpoint
ALTER TABLE "request_revisions" ADD CONSTRAINT "request_revisions_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "request_revisions_request_id_revision_index" ON "request_revisions" USING btree ("request_id","revision");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_removed_by_id_user_id_fk" FOREIGN KEY ("removed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;