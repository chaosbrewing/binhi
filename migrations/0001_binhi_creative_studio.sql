-- binhi:compatibility-reviewed: additive only. Creates four new tables
-- (binhi_projects, binhi_library_assets, binhi_asset_usages, binhi_brand_kits)
-- with indexes and foreign keys that reference only the new tables or
-- binhi_users(id) ON DELETE cascade. No existing table, column, default or
-- constraint changes, so the previous build (main @ b6570ff) reads and writes
-- unchanged; verified by running its integration suite against a database that
-- already carried this migration (docs/RELEASE_CHECKLIST_PHASE1.md §2).
CREATE TABLE IF NOT EXISTS "binhi_asset_usages" (
	"asset_id" text NOT NULL,
	"project_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_brand_kits" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"document" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_library_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"origin" text DEFAULT 'upload' NOT NULL,
	"storage" text NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"document" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_asset_usages" ADD CONSTRAINT "binhi_asset_usages_asset_id_binhi_library_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."binhi_library_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_asset_usages" ADD CONSTRAINT "binhi_asset_usages_project_id_binhi_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."binhi_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_brand_kits" ADD CONSTRAINT "binhi_brand_kits_owner_id_binhi_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_library_assets" ADD CONSTRAINT "binhi_library_assets_owner_id_binhi_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_projects" ADD CONSTRAINT "binhi_projects_owner_id_binhi_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_asset_usages_pk" ON "binhi_asset_usages" USING btree ("asset_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_asset_usages_project_idx" ON "binhi_asset_usages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_brand_kits_owner_idx" ON "binhi_brand_kits" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_library_assets_owner_idx" ON "binhi_library_assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_projects_owner_idx" ON "binhi_projects" USING btree ("owner_id");