CREATE TABLE "audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"who" text NOT NULL,
	"action" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"requisition_id" text NOT NULL,
	"name" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"mobile" text DEFAULT '' NOT NULL,
	"stage" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"designation" text NOT NULL,
	"department" text NOT NULL,
	"category" text NOT NULL,
	"doj" date,
	"mobile" text,
	"email" text,
	"shift" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"pan" text,
	"uan" text,
	"bank_account" text,
	"ifsc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "joiners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role_text" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'All' NOT NULL,
	"join_date" date,
	"done" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"employee_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_opening" (
	"employee_id" text NOT NULL,
	"type" text NOT NULL,
	"year" integer NOT NULL,
	"opening" numeric NOT NULL,
	CONSTRAINT "leave_opening_employee_id_type_year_pk" PRIMARY KEY("employee_id","type","year")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"type" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"days" numeric NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"cover" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"chain" jsonb NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "masters" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_inputs" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"employee_id" text NOT NULL,
	"component" text NOT NULL,
	"amount" numeric NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_lines" (
	"month" text NOT NULL,
	"employee_id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "payroll_lines_month_employee_id_pk" PRIMARY KEY("month","employee_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"month" text PRIMARY KEY NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "punches" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"date" date NOT NULL,
	"time" text NOT NULL,
	"direction" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reg_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"date" date NOT NULL,
	"time" text NOT NULL,
	"direction" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"chain" jsonb NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisitions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"department" text NOT NULL,
	"posts" integer DEFAULT 1 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_structure" (
	"employee_id" text NOT NULL,
	"component" text NOT NULL,
	"amount" numeric NOT NULL,
	CONSTRAINT "salary_structure_employee_id_component_pk" PRIMARY KEY("employee_id","component")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"employee_id" text,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"must_change" boolean DEFAULT true NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"last_login" timestamp with time zone,
	"pw_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit" USING btree ("at");--> statement-breakpoint
CREATE INDEX "cand_req_idx" ON "candidates" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "emp_dept_idx" ON "employees" USING btree ("department");--> statement-breakpoint
CREATE INDEX "emp_cat_idx" ON "employees" USING btree ("category");--> statement-breakpoint
CREATE INDEX "leave_emp_idx" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_status_idx" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "masters_kind_idx" ON "masters" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "payin_month_idx" ON "pay_inputs" USING btree ("month");--> statement-breakpoint
CREATE INDEX "punch_emp_date_idx" ON "punches" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "punch_date_idx" ON "punches" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_login_idx" ON "users" USING btree ("login");--> statement-breakpoint
CREATE INDEX "users_emp_idx" ON "users" USING btree ("employee_id");