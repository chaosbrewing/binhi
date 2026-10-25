import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const migrationsFolder = path.join(root, "migrations");
const baselineMigration = "0000_binhi_initial.sql";

const riskyRules = [
  {
    name: "drop",
    pattern: /\bDROP\s+(?:TABLE|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/i,
    message: "removes schema or data needed by older application code",
  },
  {
    name: "rename",
    pattern: /\bRENAME\s+(?:COLUMN|TO)\b/i,
    message: "renames an object older application code may still address",
  },
  {
    name: "alter-column",
    pattern: /\bALTER\s+COLUMN\b[^;]*?\b(?:TYPE|SET\s+NOT\s+NULL|DROP\s+NOT\s+NULL)\b/i,
    message: "changes a column contract older application code may rely on",
  },
  {
    name: "required-column-without-default",
    pattern: /\bADD\s+COLUMN\b[^;]*?\bNOT\s+NULL\b/i,
    message: "adds a required column; check existing rows and inserts from older code",
    unless: /\bDEFAULT\b/i,
  },
  {
    name: "unique",
    pattern: /\b(?:CREATE\s+UNIQUE\s+INDEX|ADD\s+CONSTRAINT\b[^;]*?\bUNIQUE)\b/i,
    message: "may reject duplicate data or writes from older application code",
  },
  {
    name: "new-constraint",
    pattern: /\bADD\s+CONSTRAINT\b[^;]*?\b(?:FOREIGN\s+KEY|CHECK)\b/i,
    message: "may reject data or writes that older application code still produces",
  },
  {
    name: "data-removal",
    pattern: /\b(?:TRUNCATE\s+(?:TABLE\s+)?|DELETE\s+FROM\s+)\b/i,
    message: "removes persisted data and is not reversed by an application rollback",
  },
];

function withoutSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/--[^\n]*/g, (comment) => comment.replace(/[^\n]/g, " "));
}

export function inspectMigrationSql(sql) {
  const normalized = withoutSqlComments(sql);
  const findings = [];

  for (const rule of riskyRules) {
    const match = rule.pattern.exec(normalized);
    if (!match) continue;
    const statementStart = normalized.lastIndexOf(";", match.index) + 1;
    const statementEnd = normalized.indexOf(";", match.index);
    const statement = normalized.slice(
      statementStart,
      statementEnd === -1 ? normalized.length : statementEnd,
    );
    if (rule.unless && rule.unless.test(statement)) continue;
    const line = normalized.slice(0, match.index).split("\n").length;
    findings.push({ name: rule.name, line, message: rule.message });
  }

  return findings;
}

export async function checkMigrationFiles(folder = migrationsFolder) {
  const files = (await readdir(folder))
    .filter((file) => file.endsWith(".sql"))
    // This already-applied bootstrap defines the schema for a fresh database,
    // not a schema change being rolled out alongside older app code.
    .filter((file) => file !== baselineMigration)
    .sort();
  const results = [];

  for (const file of files) {
    const sql = await readFile(path.join(folder, file), "utf8");
    const findings = inspectMigrationSql(sql);
    const reviewed = /^\s*--\s*binhi:compatibility-reviewed:\s*\S.+$/im.test(sql);
    results.push({ file, findings, reviewed });
  }

  return results;
}

async function main() {
  const results = await checkMigrationFiles();
  let blocked = false;

  for (const result of results) {
    if (result.findings.length === 0) continue;
    const status = result.reviewed ? "REVIEW REQUIRED (annotated)" : "BLOCKED";
    console.log(`${status}: ${result.file}`);
    for (const finding of result.findings) {
      console.log(`  line ${finding.line}: ${finding.message}`);
    }
    if (!result.reviewed) {
      console.log(
        "  Resolve with an expand/contract migration, or add a reasoned " +
          "`-- binhi:compatibility-reviewed: ...` marker after completing the release checklist.",
      );
      blocked = true;
    }
  }

  if (results.every((result) => result.findings.length === 0)) {
    console.log(
      `Migration compatibility check passed (${results.length} incremental SQL migration(s); baseline excluded).`,
    );
  }
  if (blocked) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
