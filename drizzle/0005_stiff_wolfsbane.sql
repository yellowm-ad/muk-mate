CREATE TYPE "public"."manner_rating" AS ENUM('GOOD', 'NEUTRAL', 'BAD');--> statement-breakpoint
CREATE TABLE "manner_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"review_id" uuid,
	"reason_code" text NOT NULL,
	"delta" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manner_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"score" numeric(5, 2) DEFAULT '50' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"positive_count" integer DEFAULT 0 NOT NULL,
	"negative_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manner_profiles_score_range" CHECK ("manner_profiles"."score" >= 0 AND "manner_profiles"."score" <= 100)
);
--> statement-breakpoint
CREATE TABLE "manner_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pot_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reviewee_id" uuid NOT NULL,
	"rating" "manner_rating" NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"visible_after" timestamp with time zone NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manner_reviews_no_self_review" CHECK ("manner_reviews"."reviewer_id" <> "manner_reviews"."reviewee_id")
);
--> statement-breakpoint
ALTER TABLE "manner_events" ADD CONSTRAINT "manner_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manner_events" ADD CONSTRAINT "manner_events_review_id_manner_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."manner_reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manner_profiles" ADD CONSTRAINT "manner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manner_reviews" ADD CONSTRAINT "manner_reviews_pot_id_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "public"."pots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manner_reviews" ADD CONSTRAINT "manner_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manner_reviews" ADD CONSTRAINT "manner_reviews_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manner_reviews_pot_reviewer_reviewee_key" ON "manner_reviews" USING btree ("pot_id","reviewer_id","reviewee_id");--> statement-breakpoint
CREATE INDEX "idx_manner_reviews_reviewee" ON "manner_reviews" USING btree ("reviewee_id","created_at");