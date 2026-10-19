CREATE TABLE "email_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"body" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_outbox_sent_at_next_attempt_at_index" ON "email_outbox" USING btree ("sent_at","next_attempt_at");