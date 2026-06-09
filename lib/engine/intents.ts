// Named structured-query INTENTS. The router (LLM) selects an intent + params;
// the engine runs the corresponding parameterized SELECT. The LLM never writes
// SQL — this keeps the read-only store safe while routing stays real.
//
// Each intent maps to one feature domain. Adding a feature = adding intents here
// + a description the router sees.
import { sqlSelect, getDb, type SqlRow } from "./retrieval.ts";

export type IntentName =
  | "contracts_expiring"
  | "contracts_by_vendor"
  | "overdue_or_recent_invoices"
  | "invoice_totals"
  | "payroll_summary"
  | "enrollment_overview";

// An intent returns its rows plus an optional aggregate SUMMARY (count + a named
// total) that the grounding layer surfaces so the answer can state a verifiable
// figure like "38 contracts … combined annual value $18,924,883.79".
export type IntentSummary = { label: string; count: number; total?: { name: string; value: number } };
export type IntentResult = { rows: SqlRow[]; summary?: IntentSummary };

export type IntentDef = {
  name: IntentName;
  feature: string;
  description: string; // shown to the router
  run: (params: Record<string, any>, today: string) => IntentResult;
};

export const INTENTS: IntentDef[] = [
  {
    name: "contracts_expiring",
    feature: "contract-intelligence",
    description:
      "Vendor contracts expiring within N days of today (default 90). Returns contract id, vendor, end date, annual cost. Use for 'what contracts expire in the next 90 days'.",
    run: (params, today) => {
      const days = Number(params.days ?? 90);
      const end = addDays(today, days);
      const rows = sqlSelect(
        "contracts",
        `SELECT id, contract_id, vendor, end_date, end_date_iso, annual_cost
         FROM contracts
         WHERE __malformed = 0 AND end_date_iso IS NOT NULL
           AND end_date_iso >= ? AND end_date_iso <= ?
         ORDER BY end_date_iso ASC`,
        [today, end]
      );
      // Verifiable aggregate over the SAME filtered set (count + combined value).
      const agg = getDb()
        .prepare(
          `SELECT COUNT(*) n, ROUND(SUM(annual_cost), 2) total FROM contracts
           WHERE __malformed = 0 AND end_date_iso IS NOT NULL
             AND end_date_iso >= ? AND end_date_iso <= ?`
        )
        .get(today, end) as { n: number; total: number };
      return {
        rows,
        summary: {
          label: `contracts expiring between ${today} and ${end}`,
          count: agg.n,
          total: { name: "combined annual value", value: agg.total ?? 0 },
        },
      };
    },
  },
  {
    name: "contracts_by_vendor",
    feature: "contract-intelligence",
    description: "Contracts for a specific vendor (param: vendor). Returns id, vendor, dates, annual cost.",
    run: (params) => ({
      rows: sqlSelect(
        "contracts",
        `SELECT id, contract_id, vendor, start_date, end_date, annual_cost
         FROM contracts WHERE vendor LIKE ? AND __malformed = 0 ORDER BY end_date_iso`,
        [`%${params.vendor ?? ""}%`]
      ),
    }),
  },
  {
    name: "overdue_or_recent_invoices",
    feature: "receivables-intelligence",
    description:
      "Maintenance invoices, optionally filtered to those completed before a cutoff date (param: before, ISO) to surface aging/overdue items. Returns ticket, vendor, total cost, completion date.",
    run: (params, today) => {
      const before = params.before ?? today;
      const rows = sqlSelect(
        "maintenance_invoices",
        `SELECT id, ticket_id, vendor, total_cost, completion_date, completion_date_iso
         FROM maintenance_invoices
         WHERE __malformed = 0 AND completion_date_iso IS NOT NULL AND completion_date_iso < ?
         ORDER BY completion_date_iso ASC LIMIT 50`,
        [before]
      );
      const agg = getDb()
        .prepare(
          `SELECT COUNT(*) n, ROUND(SUM(total_cost), 2) total FROM maintenance_invoices
           WHERE __malformed = 0 AND completion_date_iso IS NOT NULL AND completion_date_iso < ?`
        )
        .get(before) as { n: number; total: number };
      return {
        rows,
        summary: {
          label: `maintenance invoices completed before ${before}`,
          count: agg.n,
          total: { name: "total maintenance spend", value: agg.total ?? 0 },
        },
      };
    },
  },
  {
    name: "invoice_totals",
    feature: "receivables-intelligence",
    description: "Aggregate invoice volume per student (invoice_volume table). Returns students, invoices per student, total invoices.",
    run: () => ({
      rows: sqlSelect(
        "invoice_volume",
        `SELECT id, students, invoices_per_student_per_year, total_invoices
         FROM invoice_volume WHERE __malformed = 0 LIMIT 20`
      ),
    }),
  },
  {
    name: "payroll_summary",
    feature: "payroll-intelligence",
    description: "Payroll rows (payroll_v2): employee, department, job title, base salary, net pay. Optional param: department.",
    run: (params) => ({
      rows: sqlSelect(
        "payroll_v2",
        `SELECT id, employee_full_name, department, job_title, base_salary_monthly, net_pay
         FROM payroll_v2 WHERE __malformed = 0 ${params.department ? "AND department LIKE ?" : ""}
         ORDER BY net_pay DESC LIMIT 30`,
        params.department ? [`%${params.department}%`] : []
      ),
    }),
  },
  {
    name: "enrollment_overview",
    feature: "enrollment-intelligence",
    description: "Course enrollment rows: student, course code, enrollment date, credits. Optional param: course_code.",
    run: (params) => ({
      rows: sqlSelect(
        "enrollment",
        `SELECT id, course_code, student_full_name, student_email, enrollment_date, credits
         FROM enrollment WHERE ${params.course_code ? "course_code LIKE ?" : "1=1"}
         ORDER BY id LIMIT 30`,
        params.course_code ? [`%${params.course_code}%`] : []
      ),
    }),
  },
];

export function getIntent(name: string): IntentDef | undefined {
  return INTENTS.find((i) => i.name === name);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
