/** Personal-file columns on the employee record, shared by the employee form and the Excel template. */
export type EmpExtra = { key: "dob" | "gender" | "fatherName" | "bloodGroup" | "maritalStatus" | "address" | "permAddress" | "emergencyName" | "emergencyRelation" | "emergencyMobile" | "qualification" | "institution" | "qualYear" | "regCouncil" | "regNo" | "reportingTo"; col: string; header: string; help: string; date?: boolean; wide?: boolean };
export const EMP_EXTRA: EmpExtra[] = [
  { key: "dob", col: "dob", header: "Date of birth", help: "Date as DD-MM-YYYY or YYYY-MM-DD", date: true },
  { key: "gender", col: "gender", header: "Gender", help: "Female, Male or Other" },
  { key: "fatherName", col: "father_name", header: "Father or spouse name", help: "Optional" },
  { key: "bloodGroup", col: "blood_group", header: "Blood group", help: "e.g. B+" },
  { key: "maritalStatus", col: "marital_status", header: "Marital status", help: "Single, Married or Other" },
  { key: "address", col: "address", header: "Current address", help: "Optional", wide: true },
  { key: "permAddress", col: "perm_address", header: "Permanent address", help: "Optional", wide: true },
  { key: "emergencyName", col: "emergency_name", header: "Emergency contact", help: "Name" },
  { key: "emergencyRelation", col: "emergency_relation", header: "Emergency relation", help: "e.g. Spouse" },
  { key: "emergencyMobile", col: "emergency_mobile", header: "Emergency mobile", help: "10-digit mobile" },
  { key: "qualification", col: "qualification", header: "Qualification", help: "Highest qualification" },
  { key: "institution", col: "institution", header: "College or university", help: "Optional" },
  { key: "qualYear", col: "qual_year", header: "Year passed", help: "e.g. 2018" },
  { key: "regCouncil", col: "reg_council", header: "Registration council", help: "e.g. State Medical Council (optional)" },
  { key: "regNo", col: "reg_no", header: "Registration number", help: "Optional" },
  { key: "reportingTo", col: "reporting_to", header: "Reporting to", help: "Employee ID of the reporting manager (optional)" },
];
export const GENDERS = ["Female", "Male", "Other"];
export const MARITAL = ["Single", "Married", "Other"];
