import { pgTable, text, integer, boolean, jsonb, serial, timestamp, date, numeric, primaryKey, index, uniqueIndex, customType } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Key/value settings: institute profile, password policy, attendance rules, workflows, access matrix. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Master fields. `kind` names the master (dept, desig, cat, leave, src, shift, hol, sal, docs); `data` holds its column values in order. */
export const masters = pgTable("masters", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  data: jsonb("data").$type<(string | number)[]>().notNull(),
  active: boolean("active").default(true).notNull(),
  sort: integer("sort").default(0).notNull(),
}, (t) => [index("masters_kind_idx").on(t.kind)]);

export type Experience = { employer: string; role: string; from: string; to: string };

export const employees = pgTable("employees", {
  id: text("id").primaryKey(), // e.g. F-1042 (category code + number); the institute prefix is added for display and login
  name: text("name").notNull(),
  designation: text("designation").notNull(),
  department: text("department").notNull(),
  category: text("category").notNull(),
  doj: date("doj", { mode: "string" }),
  mobile: text("mobile"),
  email: text("email"),
  shift: text("shift"),
  status: text("status").default("Active").notNull(), // Active, Probation, On notice, Exited
  pan: text("pan"),
  uan: text("uan"),
  bankAccount: text("bank_account"),
  ifsc: text("ifsc"),
  // Personal file. Aadhaar is stored encrypted (aadhaarEnc) with only the last four digits in clear.
  dob: date("dob", { mode: "string" }),
  gender: text("gender"),
  fatherName: text("father_name"),
  bloodGroup: text("blood_group"),
  maritalStatus: text("marital_status"),
  address: text("address"),
  permAddress: text("perm_address"),
  emergencyName: text("emergency_name"),
  emergencyRelation: text("emergency_relation"),
  emergencyMobile: text("emergency_mobile"),
  aadhaarEnc: text("aadhaar_enc"),
  aadhaarLast4: text("aadhaar_last4"),
  qualification: text("qualification"),
  institution: text("institution"),
  qualYear: text("qual_year"),
  regCouncil: text("reg_council"),
  regNo: text("reg_no"),
  reportingTo: text("reporting_to"),
  experience: jsonb("experience").$type<Experience[]>(),
  photoFileId: integer("photo_file_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("emp_dept_idx").on(t.department), index("emp_cat_idx").on(t.category)]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  login: text("login").notNull(), // employee ID without prefix, or "ADMIN"
  employeeId: text("employee_id"),
  name: text("name").notNull(),
  role: text("role").notNull(), // admin, hr, accounts, management, hod, staff
  passwordHash: text("password_hash").notNull(),
  status: text("status").default("Active").notNull(), // Active, Locked, Disabled
  mustChange: boolean("must_change").default(true).notNull(),
  failed: integer("failed").default(0).notNull(),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  pwChangedAt: timestamp("pw_changed_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("users_login_idx").on(t.login), index("users_emp_idx").on(t.employeeId)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const punches = pgTable("punches", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  time: text("time").notNull(), // HH:MM, 24-hour
  direction: text("direction").notNull(), // In, Out
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("punch_emp_date_idx").on(t.employeeId, t.date), index("punch_date_idx").on(t.date)]);

export type Step = { level: string; by: string; action: string; at: string; note?: string };

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  type: text("type").notNull(),
  fromDate: date("from_date", { mode: "string" }).notNull(),
  toDate: date("to_date", { mode: "string" }).notNull(),
  days: numeric("days", { mode: "number" }).notNull(),
  reason: text("reason").default("").notNull(),
  cover: text("cover").default("").notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, rejected, cancelled
  chain: jsonb("chain").$type<string[]>().notNull(),
  level: integer("level").default(0).notNull(),
  history: jsonb("history").$type<Step[]>().default([]).notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("leave_emp_idx").on(t.employeeId), index("leave_status_idx").on(t.status)]);

export const regRequests = pgTable("reg_requests", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  time: text("time").notNull(),
  direction: text("direction").notNull(),
  reason: text("reason").default("").notNull(),
  status: text("status").default("pending").notNull(),
  chain: jsonb("chain").$type<string[]>().notNull(),
  level: integer("level").default(0).notNull(),
  history: jsonb("history").$type<Step[]>().default([]).notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
});

export const leaveOpening = pgTable("leave_opening", {
  employeeId: text("employee_id").notNull(),
  type: text("type").notNull(),
  year: integer("year").notNull(),
  opening: numeric("opening", { mode: "number" }).notNull(),
}, (t) => [primaryKey({ columns: [t.employeeId, t.type, t.year] })]);

export const salaryStructure = pgTable("salary_structure", {
  employeeId: text("employee_id").notNull(),
  component: text("component").notNull(),
  amount: numeric("amount", { mode: "number" }).notNull(),
}, (t) => [primaryKey({ columns: [t.employeeId, t.component] })]);

export const payInputs = pgTable("pay_inputs", {
  id: serial("id").primaryKey(),
  month: text("month").notNull(), // YYYY-MM
  employeeId: text("employee_id").notNull(),
  component: text("component").notNull(),
  amount: numeric("amount", { mode: "number" }).notNull(),
  remarks: text("remarks").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("payin_month_idx").on(t.month)]);

export const payrollRuns = pgTable("payroll_runs", {
  month: text("month").primaryKey(),
  step: integer("step").default(0).notNull(), // 0 not computed, 1 computed, 2 HR reviewed, 3 accounts approved, 4 closed
  history: jsonb("history").$type<Step[]>().default([]).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PayLine = { earnings: [string, number][]; deductions: [string, number][]; employer: [string, number][]; gross: number; ded: number; net: number; paidDays: number; days: number; lop: number };

export const payrollLines = pgTable("payroll_lines", {
  month: text("month").notNull(),
  employeeId: text("employee_id").notNull(),
  data: jsonb("data").$type<PayLine>().notNull(),
}, (t) => [primaryKey({ columns: [t.month, t.employeeId] })]);

export const requisitions = pgTable("requisitions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  posts: integer("posts").default(1).notNull(),
  note: text("note").default("").notNull(),
  status: text("status").default("Open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  requisitionId: text("requisition_id").notNull(),
  name: text("name").notNull(),
  details: text("details").default("").notNull(),
  mobile: text("mobile").default("").notNull(),
  stage: integer("stage").default(0).notNull(), // 0 Applied .. 4 Joining, -1 Not selected
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("cand_req_idx").on(t.requisitionId)]);

export const joiners = pgTable("joiners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  roleText: text("role_text").default("").notNull(),
  kind: text("kind").default("All").notNull(), // Doctors, Nursing, Paramedical, All
  joinDate: date("join_date", { mode: "string" }),
  done: jsonb("done").$type<Record<string, boolean>>().default({}).notNull(),
  employeeId: text("employee_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** One-time joining-form links. Only a hash of the link token is stored; a new link replaces the old one. */
export type JoinerStatus = "sent" | "opened" | "submitted" | "corrections" | "accepted" | "rejected" | "cancelled";
export const joinerInvites = pgTable("joiner_invites", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash"),
  name: text("name").notNull(),
  mobile: text("mobile").default("").notNull(),
  email: text("email").default("").notNull(),
  category: text("category").notNull(),
  department: text("department").notNull(),
  designation: text("designation").notNull(),
  shift: text("shift"),
  joinDate: date("join_date", { mode: "string" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: text("status").$type<JoinerStatus>().default("sent").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
  checks: jsonb("checks").$type<Record<string, boolean>>().default({}).notNull(),
  note: text("note").default("").notNull(),
  employeeId: text("employee_id"),
  history: jsonb("history").$type<Step[]>().default([]).notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdBy: text("created_by").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("jinv_token_idx").on(t.tokenHash), index("jinv_status_idx").on(t.status)]);

/** Uploaded documents: from the joining form (inviteId) and, once accepted, linked to the employee. */
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  inviteId: integer("invite_id"),
  employeeId: text("employee_id"),
  kind: text("kind").notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("files_inv_idx").on(t.inviteId), index("files_emp_idx").on(t.employeeId)]);

export const audit = pgTable("audit", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  who: text("who").notNull(),
  action: text("action").notNull(),
}, (t) => [index("audit_at_idx").on(t.at)]);
