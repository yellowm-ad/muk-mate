CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "jbnu_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "jbnu_email_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_email_verifications_email_created" ON "email_verifications" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_jbnu_email_key" ON "users" USING btree ("jbnu_email");