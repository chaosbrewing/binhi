-- binhi:compatibility-reviewed: Additive Template Library details (founder-approved D2). Every new column is nullable with no default and is unused by older builds, which ignore it; no existing row or insert changes. The unique index and foreign key are on the new, empty binhi_template_favorites table that older builds never touch. Older builds keep working against this schema; do not drop the columns or table on rollback (favorites and personal-template details would be lost). Production application still needs the release checklist and a backup, and is a separate founder approval.
CREATE TABLE IF NOT EXISTS "binhi_template_favorites" (
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "binhi_projects" ADD COLUMN "source_template_id" text;--> statement-breakpoint
ALTER TABLE "binhi_projects" ADD COLUMN "source_template_version" integer;--> statement-breakpoint
ALTER TABLE "binhi_projects" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "binhi_projects" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "binhi_projects" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "binhi_projects" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "binhi_sites" ADD COLUMN "source_template_id" text;--> statement-breakpoint
ALTER TABLE "binhi_sites" ADD COLUMN "source_template_version" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_template_favorites" ADD CONSTRAINT "binhi_template_favorites_user_id_binhi_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_template_favorites_pk" ON "binhi_template_favorites" USING btree ("user_id","template_id");