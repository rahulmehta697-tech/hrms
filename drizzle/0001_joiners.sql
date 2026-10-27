CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"invite_id" integer,
	"employee_id" text,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "joiner_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text,
	"name" text NOT NULL,
	"mobile" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"department" text NOT NULL,
	"designation" text NOT NULL,
	"shift" text,
	"join_date" date,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"employee_id" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opened_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "dob" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "father_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "blood_group" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "marital_status" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "perm_address" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_relation" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_mobile" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "aadhaar_enc" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "aadhaar_last4" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "qualification" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "institution" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "qual_year" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "reg_council" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "reg_no" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "reporting_to" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "experience" jsonb;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "photo_file_id" integer;--> statement-breakpoint
CREATE INDEX "files_inv_idx" ON "files" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX "files_emp_idx" ON "files" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jinv_token_idx" ON "joiner_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "jinv_status_idx" ON "joiner_invites" USING btree ("status");