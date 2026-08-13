CREATE TYPE "public"."friend_request_status" AS ENUM('PENDING', 'ACCEPTED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'FRIEND_REQUEST_RECEIVED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'FRIEND_REQUEST_ACCEPTED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'POT_INVITED';--> statement-breakpoint
ALTER TYPE "public"."room_type" ADD VALUE 'DM';--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" "friend_request_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD COLUMN "dm_user_a_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD COLUMN "dm_user_b_id" uuid;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_pair_key" ON "friend_requests" USING btree ("requester_id","addressee_id");--> statement-breakpoint
CREATE INDEX "idx_friend_requests_addressee_status" ON "friend_requests" USING btree ("addressee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_blocks_pair_key" ON "user_blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_dm_user_a_id_users_id_fk" FOREIGN KEY ("dm_user_a_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_dm_user_b_id_users_id_fk" FOREIGN KEY ("dm_user_b_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_rooms_dm_pair_key" ON "chat_rooms" USING btree ("dm_user_a_id","dm_user_b_id");