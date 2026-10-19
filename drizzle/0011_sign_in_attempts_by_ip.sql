-- Rows are short-lived attempt counters; dropping them only resets in-progress lockouts.
TRUNCATE "sign_in_failures";--> statement-breakpoint
ALTER TABLE "sign_in_failures" DROP CONSTRAINT "sign_in_failures_pkey";--> statement-breakpoint
ALTER TABLE "sign_in_failures" ADD COLUMN "ip_address" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "sign_in_failures" ADD CONSTRAINT "sign_in_failures_email_ip_address_pk" PRIMARY KEY("email","ip_address");
