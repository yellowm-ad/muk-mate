CREATE TYPE "public"."approval" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('TEXT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."pot_status" AS ENUM('OPEN', 'CLOSED', 'ORDERED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."room_type" AS ENUM('ORDER', 'COMMUNITY');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('HEADCOUNT', 'AMOUNT');--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "room_type" NOT NULL,
	"pot_id" uuid,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_rooms_pot_id_unique" UNIQUE("pot_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"sender_id" uuid,
	"type" "message_type" DEFAULT 'TEXT' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"apply_message" text,
	"menu_amount" integer,
	"approval_status" "approval" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"zone_code" text NOT NULL,
	"store_name" text NOT NULL,
	"store_address" text,
	"store_lat" numeric(10, 7),
	"store_lng" numeric(10, 7),
	"order_summary" text NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_value" integer NOT NULL,
	"delivery_fee" integer,
	"deadline_at" timestamp with time zone NOT NULL,
	"pickup_at" timestamp with time zone,
	"pickup_name" text NOT NULL,
	"pickup_address" text,
	"pickup_lat" numeric(10, 7),
	"pickup_lng" numeric(10, 7),
	"pickup_note" text,
	"extra_note" text,
	"status" "pot_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login_id" text NOT NULL,
	"password_hash" text NOT NULL,
	"nickname" text NOT NULL,
	"zone_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_login_id_unique" UNIQUE("login_id")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_pot_id_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "public"."pots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_pot_id_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "public"."pots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pots" ADD CONSTRAINT "pots_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pots" ADD CONSTRAINT "pots_zone_code_zones_code_fk" FOREIGN KEY ("zone_code") REFERENCES "public"."zones"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_zone_code_zones_code_fk" FOREIGN KEY ("zone_code") REFERENCES "public"."zones"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_messages_room" ON "messages" USING btree ("room_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "participations_pot_user_key" ON "participations" USING btree ("pot_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_participations_user" ON "participations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_pots_zone_status" ON "pots" USING btree ("zone_code","status","deadline_at");