CREATE TABLE IF NOT EXISTS "binhi_asset_blobs" (
	"key" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"site_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text DEFAULT '' NOT NULL,
	"folder" text DEFAULT '' NOT NULL,
	"storage" text NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"site_id" text,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_form_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"form_node_id" text NOT NULL,
	"page_path" text NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_op_batches" (
	"site_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"result_revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"revision" integer NOT NULL,
	"revision_id" text NOT NULL,
	"state" text NOT NULL,
	"adapter" text NOT NULL,
	"slug" text NOT NULL,
	"url" text,
	"page_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"requested_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_published_pages" (
	"publication_id" text NOT NULL,
	"path" text NOT NULL,
	"page_id" text NOT NULL,
	"html" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_site_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"revision" integer NOT NULL,
	"document" jsonb NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_sites" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"template_id" text NOT NULL,
	"document" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"live_publication_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_assets" ADD CONSTRAINT "binhi_assets_owner_id_binhi_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_assets" ADD CONSTRAINT "binhi_assets_site_id_binhi_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."binhi_sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_form_submissions" ADD CONSTRAINT "binhi_form_submissions_site_id_binhi_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."binhi_sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_op_batches" ADD CONSTRAINT "binhi_op_batches_site_id_binhi_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."binhi_sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_publications" ADD CONSTRAINT "binhi_publications_site_id_binhi_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."binhi_sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_published_pages" ADD CONSTRAINT "binhi_published_pages_publication_id_binhi_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."binhi_publications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_sessions" ADD CONSTRAINT "binhi_sessions_user_id_binhi_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_site_revisions" ADD CONSTRAINT "binhi_site_revisions_site_id_binhi_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."binhi_sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_sites" ADD CONSTRAINT "binhi_sites_owner_id_binhi_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_assets_site_idx" ON "binhi_assets" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_audit_site_idx" ON "binhi_audit_log" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_form_submissions_site_idx" ON "binhi_form_submissions" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_op_batches_pk" ON "binhi_op_batches" USING btree ("site_id","batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_publications_site_idx" ON "binhi_publications" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_published_pages_pk" ON "binhi_published_pages" USING btree ("publication_id","path");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_sessions_token_idx" ON "binhi_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_sessions_user_idx" ON "binhi_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_site_revisions_site_rev_idx" ON "binhi_site_revisions" USING btree ("site_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_sites_slug_idx" ON "binhi_sites" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_sites_owner_idx" ON "binhi_sites" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_users_email_idx" ON "binhi_users" USING btree ("email");