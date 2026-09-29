// Echo · checagem de RLS nas migrações (página 25, A2)
// Toda tabela criada em supabase/migrations precisa de ENABLE ROW LEVEL SECURITY.
// Também confere se toda função SECURITY DEFINER fixa o search_path.
// Uso: node scripts/check-rls.mjs   (sai com código 1 se achar problema)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const created = new Map();
const rls = new Set();
const definerNoPath = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  const s = readFileSync(join(dir, f), "utf8");
  for (const m of s.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)) if (!created.has(m[1])) created.set(m[1], f);
  for (const m of s.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([a-z_0-9]+)"?\s+enable\s+row\s+level\s+security/gi)) rls.add(m[1]);
  for (const m of s.matchAll(/ARRAY\[([^\]]+)\]\s+LOOP[\s\S]*?ENABLE ROW LEVEL SECURITY/gi)) for (const t of m[1].matchAll(/'([a-z_0-9]+)'/g)) rls.add(t[1]);
  for (const m of s.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\([^)]*\)[\s\S]*?(?:as\s+\$\$|as\s+\$[a-z_]*\$)/gi)) {
    if (/security\s+definer/i.test(m[0]) && !/search_path/i.test(m[0])) definerNoPath.push(`${m[1]} (${f})`);
  }
}
const missing = [...created.keys()].filter((t) => !rls.has(t));
console.log(`${created.size} tabelas criadas nas migrações · ${missing.length} sem RLS · ${definerNoPath.length} funções SECURITY DEFINER sem search_path`);
for (const t of missing) console.log(`  ✗ sem RLS: ${t} (${created.get(t)})`);
for (const f of definerNoPath) console.log(`  ! sem search_path: ${f}`);
process.exit(missing.length ? 1 : 0);
