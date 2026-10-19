CREATE TABLE "sign_in_failures" (
	"email" varchar(255) PRIMARY KEY NOT NULL,
	"failures" integer NOT NULL,
	"first_failed_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone
);
