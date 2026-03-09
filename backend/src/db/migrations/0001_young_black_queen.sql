-- ALTER TYPE "campaign_status" ADD VALUE 'draft';
-- ALTER TYPE "campaign_status" ADD VALUE 'scheduled';
-- ALTER TYPE "campaign_status" ADD VALUE 'sending';
-- ALTER TYPE "campaign_status" ADD VALUE 'cancelled';
-- ALTER TYPE "user_role" ADD VALUE 'campaign_manager';
ALTER TABLE "messages" DROP CONSTRAINT "messages_campaign_id_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'campaign_manager';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'campaign_manager';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "type" "campaign_type" DEFAULT 'voice' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "mode" "campaign_mode" DEFAULT 'one_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "audience" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "recurring_interval" "recurring_interval";--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "recurring_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "next_run_date" timestamp;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "total_cost" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "type" "message_type" DEFAULT 'voice' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_source" "audio_source" DEFAULT 'tts';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sms_body" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sms_segments" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_member_idx" ON "recipient_group_members" ("recipient_id","group_id");