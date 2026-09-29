"""
Echo · gera o esquema-base (tabelas que o banco antigo tinha e que nenhuma
migração cria) a partir de src/integrations/supabase/types.ts.
Uso: python3 scripts/gen-base-schema.py > /tmp/tabelas.sql
Os tipos do Supabase trazem colunas, nulos, opcionais no Insert (= têm padrão)
e relações; o resto (padrões de texto, unicidade) segue as regras abaixo.
"""
import glob, re, sys, os

ROOT = os.path.join(os.path.dirname(__file__), "..")
TYPES = open(os.path.join(ROOT, "src/integrations/supabase/types.ts")).read()
MIGS = "".join(open(f).read() for f in glob.glob(os.path.join(ROOT, "supabase/migrations/*.sql")))
created = {m.group(1) for m in re.finditer(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?', MIGS, re.I)}

tables_src = TYPES[TYPES.index("    Tables: {"):TYPES.index("    Views: {")]
blocks = re.split(r"\n      (?=[a-z_0-9]+: \{\n        Row:)", tables_src)

def fields(block, section):
    m = re.search(section + r": \{\n(.*?)\n        \}", block, re.S)
    out = {}
    if not m: return out
    for line in m.group(1).splitlines():
        mm = re.match(r"\s+([a-z_0-9]+)(\??): (.+)$", line)
        if mm: out[mm.group(1)] = (mm.group(2) == "?", mm.group(3).strip())
    return out

def rels(block):
    out = []
    for m in re.finditer(r'columns: \["([a-z_0-9]+)"\]\s*isOneToOne: (true|false)\s*referencedRelation: "([a-z_0-9]+)"\s*referencedColumns: \["([a-z_0-9]+)"\]', block):
        out.append((m.group(1), m.group(2) == "true", m.group(3), m.group(4)))
    return out

# Padrões de texto conhecidos (colunas NOT NULL opcionais no Insert).
TEXT_DEFAULTS = {
    ("brands", "status"): "'ativo'", ("profiles", "role"): "'client'", ("team_members", "kind"): "'agency'",
    ("team_members", "palette"): "'purple'", ("brand_members", "member_role"): "'client'",
    # Valores tirados do próprio código (dados de exemplo e filtros das telas).
    ("agency_events", "category"): "'evento'", ("agency_events", "status"): "'agendado'",
    ("agency_invites", "status"): "'pendente'", ("agency_posts", "kind"): "'aviso'", ("app_settings", "default_theme"): "'light'",
    ("objectives", "period_type"): "'mensal'", ("objectives", "status"): "'em_andamento'",
    ("espaco360_initiatives", "priority"): "'media'", ("espaco360_initiatives", "status"): "'planejada'",
    ("espaco360_campaigns", "priority"): "'media'", ("espaco360_campaigns", "stage"): "'planejamento'", ("espaco360_campaigns", "status"): "'planejada'",
    ("biblioteca_ideias", "priority"): "'sem_prioridade'", ("biblioteca_ideias", "status"): "'a_fazer'",
    ("brand_access_logs", "event"): "'acesso'", ("brand_access_logs", "status"): "'ok'",
    ("brand_identity_colors", "category"): "'apoio'", ("brand_identity_colors", "source"): "'manual'", ("brand_identity_models", "status"): "'ativo'",
    ("brand_invites", "member_role"): "'client'", ("brand_invites", "status"): "'pendente'",
    ("espaco360_tasks", "owner_scope"): "'agencia'", ("espaco360_tasks", "priority"): "'media'", ("espaco360_tasks", "status"): "'pendente'",
    ("conteudos", "status"): "'rascunho'", ("deliveries", "status"): "'entregue'",
    ("espaco360_calendar_events", "event_type"): "'publicacao'", ("espaco360_calendar_events", "status"): "'agendado'",
    ("espaco360_channels", "status"): "'ativo'", ("espaco360_meeting_tasks", "status"): "'pendente'", ("espaco360_notes", "kind"): "'nota'",
    ("kpis", "source"): "'manual'", ("referencias", "category"): "'geral'",
    ("solicitacoes", "priority"): "'media'", ("solicitacoes", "status"): "'nova'",
    ("workspace_dispatches", "origin"): "'criacao'", ("workspace_dispatches", "status"): "'pendente'",
}
JSON_DEFAULTS = {("brands", "modules"): "'{}'::jsonb", ("workspace_dispatches", "payload"): "'{}'::jsonb"}
INT_HINT = re.compile(r"(index|order|count|position|year|quarter|priority_rank|version|number|sort|week|day|size|width|height|duration|total|qty|quantity|minutes|hours|score)$")

def sqltype(table, col, ts, relcols):
    t = ts.replace(" | null", "")
    if "Enums" in t: return "public.app_role"
    if t == "string":
        if col == "id" or col in relcols or col.endswith("_id") or col in ("owner_id", "created_by", "updated_by", "resolved_by"): return "uuid"
        if col.endswith("_at"): return "timestamptz"
        if col.endswith("_date") or col in ("date", "birthday"): return "date"
        return "text"
    if t == "number": return "integer" if INT_HINT.search(col) else "numeric"
    if t == "boolean": return "boolean"
    if t == "Json": return "jsonb"
    if t == "string[]": return "uuid[]" if col.endswith("_ids") else "text[]"
    if t == "number[]": return "numeric[]"
    return "text"

def default(table, col, typ, ts):
    if col == "id" and typ == "uuid": return "gen_random_uuid()"
    if typ == "timestamptz": return "now()"
    if typ == "date": return "current_date"
    if typ == "boolean": return "true" if col in ("active", "enabled", "visible", "is_active") else "false"
    if (table, col) in JSON_DEFAULTS: return JSON_DEFAULTS[(table, col)]
    if typ == "jsonb": return "'[]'::jsonb" if re.search(r"(s|refs|attachments|channels|materials|palettes|items|fields|checklist|links)$", col) else "'{}'::jsonb"
    if typ.endswith("[]"): return "'{}'"
    if typ in ("integer", "numeric"): return "0"
    if typ == "public.app_role": return "'client'"
    return TEXT_DEFAULTS.get((table, col), "''")

tables = {}
for b in blocks:
    m = re.match(r"\s*([a-z_0-9]+): \{\n        Row:", b)
    if not m: continue
    name = m.group(1)
    tables[name] = (fields(b, "Row"), fields(b, "Insert"), rels(b))

missing = [t for t in tables if t not in created]
# Ordem: referenciadas primeiro.
order, seen = [], set()
def visit(t, stack=()):
    if t in seen or t not in missing: return
    for (_, _, ref, _) in tables[t][2]:
        if ref != t and ref not in stack: visit(ref, stack + (t,))
    seen.add(t); order.append(t)
for t in sorted(missing): visit(t)

print("-- Gerado por scripts/gen-base-schema.py a partir de types.ts")
for t in order:
    row, ins, rl = tables[t]
    relcols = {c for (c, _, _, _) in rl}
    cols, extra = [], []
    for c, (_, ts) in row.items():
        typ = sqltype(t, c, ts, relcols)
        nullable = "| null" in ts
        opt = ins.get(c, (False, ""))[0]
        line = f"  {c} {typ}"
        if c == "id" and t != "profiles": line += " PRIMARY KEY"
        if not nullable and c != "id": line += " NOT NULL"
        if opt and not nullable or (opt and c == "id"):
            if not (t == "profiles" and c == "id"): line += f" DEFAULT {default(t, c, typ, ts)}"
        elif opt and nullable and typ in ("jsonb",) and False: pass
        cols.append(line)
    if t == "profiles": cols[[i for i, x in enumerate(cols) if x.strip().startswith("id ")][0]] = "  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE"
    if "id" not in row:
        keys = [c for c in ("brand_id", "user_id", "post_id", "channel_id", "color_id") if c in row]
        if len(keys) >= 2: extra.append(f"  PRIMARY KEY ({', '.join(keys[:2])})")
    for (c, one, ref, rc) in rl:
        if ref not in tables and ref != "users": continue
        refname = f"public.{ref}"
        ondel = "CASCADE" if c in ("brand_id", "post_id", "channel_id", "organization_id") or ref in ("brands",) else "SET NULL"
        if "| null" not in row.get(c, (False, "| null"))[1] and ondel == "SET NULL": ondel = "CASCADE"
        extra.append(f"  FOREIGN KEY ({c}) REFERENCES {refname}({rc}) ON DELETE {ondel}")
        if one: extra.append(f"  UNIQUE ({c})")
    if "slug" in row and t in ("brands", "organizations"): extra.append("  UNIQUE (slug)")
    body = ",\n".join(cols + extra)
    print(f"\nCREATE TABLE IF NOT EXISTS public.{t} (\n{body}\n);")
    print(f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY;")
    for c in row:
        if c.endswith("_id") and c != "id": print(f"CREATE INDEX IF NOT EXISTS {t}_{c}_idx ON public.{t} ({c});")

print("\n-- tabelas:", len(order), file=sys.stderr)
print(" ".join(order), file=sys.stderr)
