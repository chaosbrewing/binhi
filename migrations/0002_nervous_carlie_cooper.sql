-- binhi:compatibility-reviewed: Additive social authentication. New unique/FK constraints apply only to new tables unused by older builds; password_enabled defaults true for all existing users and old inserts. OAuth-only hashes are explicitly unusable by old password verifiers. Do not drop new identity tables on rollback; OAuth-only login needs the new build restored.
CREATE TABLE IF NOT EXISTS "binhi_auth_grants" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_auth_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "binhi_oauth_transactions" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"binding_hash" text NOT NULL,
	"provider" text NOT NULL,
	"intent" text NOT NULL,
	"nonce_hash" text NOT NULL,
	"verifier_ciphertext" text,
	"user_id" text,
	"session_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "binhi_users" ADD COLUMN "password_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_auth_grants" ADD CONSTRAINT "binhi_auth_grants_user_id_binhi_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_auth_grants" ADD CONSTRAINT "binhi_auth_grants_session_id_binhi_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."binhi_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_auth_identities" ADD CONSTRAINT "binhi_auth_identities_user_id_binhi_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_oauth_transactions" ADD CONSTRAINT "binhi_oauth_transactions_user_id_binhi_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."binhi_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "binhi_oauth_transactions" ADD CONSTRAINT "binhi_oauth_transactions_session_id_binhi_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."binhi_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_auth_grants_expiry_idx" ON "binhi_auth_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_auth_identity_subject_idx" ON "binhi_auth_identities" USING btree ("issuer","subject");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "binhi_auth_identity_user_issuer_idx" ON "binhi_auth_identities" USING btree ("user_id","issuer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "binhi_oauth_transactions_expiry_idx" ON "binhi_oauth_transactions" USING btree ("expires_at");