// ---------------------------------------------------------------------------
// BRAND — Plano estratégico (página 11)
//
// Seções do plano por etapa (brand_home_sections), objetivos, estratégias
// (iniciativas) e campanhas derivadas. Cada alteração de campo grava uma versão
// (antes/depois); a equipe comenta por seção; o cliente só sugere, e a sugestão
// vira uma Solicitação no Espaço 360. Sem banco, roda em memória.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import {
  createInitiative, createObjective, createSection, createSolicitacao, getBrandBySlug, newFieldKey, updateInitiative, updateObjective, updateSectionFields,
  type BrandHomeSection, type Initiative, type Objective, type SectionField,
} from "@/lib/reach-data";
import { applyTemplateToBrand, resolveBrandStage, type PlanTemplate } from "@/lib/agency-data";
import { listPlans } from "@/lib/settings-data";
import { isDemoMode } from "@/lib/home-data";
import { ROSTER } from "@/lib/clients-data";

const db = supabase as any;
const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const clone = <T,>(x: T): T => structuredClone(x);
const ago = (d: number) => new Date(Date.now() - d * 86400e3).toISOString();

export type PlanBrand = { id: string; name: string; slug: string; description: string | null; primary: string | null; accent: string | null; logoUrl: string | null };
export type PlanCampaign = { id: string; title: string; status: string; initiative_id: string | null; stage?: string; start_date?: string | null; end_date?: string | null; description?: string | null; responsible?: string | null; objective_id?: string | null };
export type PlanData = { brand: PlanBrand; sections: BrandHomeSection[]; objectives: Objective[]; initiatives: Initiative[]; campaigns: PlanCampaign[] };
export type SectionComment = { id: string; section_id: string; author_name: string | null; body: string; created_at: string };
export type SectionVersion = { id: string; section_id: string; author_name: string | null; field_label: string | null; before_value: string | null; after_value: string | null; created_at: string };

export const fieldsOf = (s: BrandHomeSection) => ((s.fields as unknown as SectionField[]) ?? []);
const filled = (f: SectionField) => !!String(f.value ?? "").trim();

/** Progresso da etapa: obrigatórios preenchidos / obrigatórios (ou todos, se não houver obrigatórios). */
export function stageProgress(sections: BrandHomeSection[]) {
  const all = sections.flatMap(fieldsOf);
  const req = all.filter((f) => f.required);
  const base = req.length ? req : all;
  const done = base.filter(filled).length;
  return { done, total: base.length, required: req.length > 0, percent: base.length ? Math.round((done / base.length) * 100) : 0 };
}

// ----- exemplo em memória -----------------------------------------------------

type DemoPlan = PlanData & { comments: SectionComment[]; versions: SectionVersion[]; solicitacoes: { id: string; title: string; description: string; created_at: string }[] };
const store = new Map<string, DemoPlan>();
function demo(slug: string): DemoPlan {
  if (store.has(slug)) return store.get(slug)!;
  const b = `b-${slug}`;
  const t = now();
  let n = 0;
  const f = (label: string, type: SectionField["type"], value = "", extra: Partial<SectionField> = {}): SectionField => ({ key: newFieldKey(label), label, type, value, ...extra });
  const sec = (stage: string, title: string, fields: SectionField[]): BrandHomeSection => ({ id: `s${++n}`, brand_id: b, stage, section_key: newFieldKey(title), title, order_index: n, fields: fields as never, created_at: t, updated_at: t });
  const sections = [
    sec("alicerce", "Minha empresa", [f("Descrição institucional", "texto_longo", "Ateliê de perfumaria artesanal fundado em 2019, com fragrâncias autorais produzidas em pequenos lotes.", { required: true }), f("Diferenciais", "lista", "Matérias-primas naturais\nProdução em pequenos lotes\nRecarga dos frascos", { required: true }), f("Ano de fundação", "numero", "2019")]),
    sec("alicerce", "Público", [f("Público-alvo", "texto_longo", "Mulheres e homens de 28 a 50 anos que valorizam produtos autorais e experiências sensoriais.", { required: true }), f("Dores e desejos", "texto_longo", "", { required: true }), f("Maturidade do público", "escala", "3", { options: ["1", "2", "3", "4", "5"] })]),
    sec("estrutura", "Posicionamento", [f("Proposta de valor", "texto_longo", "Perfumes com alma de ateliê: cada frasco conta de onde vêm suas notas.", { required: true }), f("Tom de voz", "selecao_multipla", "Sensorial, Acolhedor", { options: ["Sensorial", "Acolhedor", "Sofisticado", "Divertido", "Técnico"], required: true }), f("Pilares de conteúdo", "pilares", "Bastidores, Produto, Educação")]),
    sec("estrutura", "Canais prioritários", [f("Canais", "canais", "Instagram, TikTok"), f("Frequência semanal", "numero", "5")]),
    sec("comunicacao", "Mensagens-chave", [f("Mensagem principal", "texto_curto", "Sinta a origem.", { required: true }), f("Mensagens de apoio", "lista", "")]),
    sec("conhecimento", "Estrutura da marca", [f("Propósito", "texto_longo", "Aproximar as pessoas da origem de cada aroma."), f("Personas", "lista", "Marina, 34, arquiteta que coleciona perfumes\nRoberto, 45, presenteia com frequência"), f("Arquétipos", "selecao_multipla", "Criador, Amante", { options: ["Criador", "Amante", "Sábio", "Explorador", "Governante"] }), f("Territórios", "lista", "Natureza\nArtesanato\nMemória afetiva")]),
    sec("conhecimento", "Mercado e concorrência", [f("Cenário", "texto_longo", "Perfumaria de nicho cresce 12% ao ano no Brasil."), f("Concorrentes", "lista", "Granado Phebo\nIsabel Leal\nCasa Veroni")]),
    sec("conhecimento", "Radar de tendências", [f("Tendências", "lista", "Refil e sustentabilidade\nNotas gourmand\nPerfumaria de camadas"), f("Relevância para a marca", "escala", "4", { options: ["1", "2", "3", "4", "5"] })]),
    sec("conhecimento", "Referências e benchmarks", [f("Marcas de referência", "lista", "Le Labo\nAesop\nByredo")]),
    sec("conhecimento", "Evolução e maturidade", [f("Maturidade digital", "escala", "3", { options: ["1", "2", "3", "4", "5"] }), f("Próximo passo", "texto_curto", "Consolidar comunidade no Instagram")]),
  ];
  const obj = (id: string, title: string, period_type: string, period_label: string, target: number, current: number, unit: string, status: string): Objective => ({ id, brand_id: b, title, description: null, period_type, period_label, target_value: target, current_value: current, unit, status, order_index: 0, created_at: t, updated_at: t });
  const objectives = [
    obj("o1", "Dobrar a base de seguidores engajados", "anual", "2026", 20000, 13400, "seguidores", "em_andamento"),
    obj("o2", "Lançar a Coleção Outono com 300 vendas", "trimestral", "4º tri 2026", 300, 96, "vendas", "em_andamento"),
    obj("o3", "Taxa de engajamento acima de 4%", "mensal", "Outubro", 4, 4.6, "%", "atingido"),
    obj("o4", "Aumentar recompra do refil", "trimestral", "3º tri 2026", 25, 19, "%", "nao_atingido"),
  ];
  const ini = (id: string, title: string, objective_id: string, priority: string, status: string, description: string): Initiative => ({ id, brand_id: b, title, objective_id, priority, status, description, semester: null, order_index: 0, created_at: t, updated_at: t });
  const initiatives = [
    ini("in1", "Conteúdo de bastidores semanal", "o1", "imediato", "em_andamento", "Reels e carrosséis mostrando o processo do ateliê."),
    ini("in2", "Campanha de lançamento da coleção", "o2", "curto_prazo", "em_andamento", "Contagem regressiva, pré-venda e evento no ateliê."),
    ini("in3", "Programa de recompra do refil", "o4", "medio_prazo", "nao_concluida", "Lembretes e benefício na terceira recarga."),
    ini("in4", "Guia de uso de perfume", "o3", "imediato", "concluida", "Série educativa sobre aplicação e conservação."),
  ];
  const data: DemoPlan = {
    brand: { id: b, name: ROSTER.find((r) => r[1] === slug)?.[0] ?? slug, slug, description: "Ateliê de perfumaria artesanal.", primary: null, accent: null, logoUrl: null },
    sections, objectives, initiatives,
    campaigns: [{ id: "cp1", title: "Lançamento Coleção Outono", status: "em_andamento", initiative_id: "in2", stage: "producao", start_date: ago(10).slice(0, 10), end_date: new Date(Date.now() + 20 * 86400e3).toISOString().slice(0, 10), description: "Três fragrâncias de outono com pré-venda e evento no ateliê.", responsible: "Rafael Monteiro", objective_id: "o2" }, { id: "cp2", title: "Mês do cliente", status: "planejada", initiative_id: "in1", stage: "planejamento", start_date: new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10), end_date: new Date(Date.now() + 60 * 86400e3).toISOString().slice(0, 10), description: "Depoimentos e benefícios para quem já comprou.", responsible: "Júlia Castro", objective_id: "o1" }],
    comments: [{ id: "cm1", section_id: "s2", author_name: "Rafael Monteiro", body: "Precisamos validar as dores com a Carla na reunião de quinta.", created_at: ago(1) }],
    versions: [{ id: "v1", section_id: "s3", author_name: "Rafael Monteiro", field_label: "Proposta de valor", before_value: "Perfumes autorais feitos à mão.", after_value: "Perfumes com alma de ateliê: cada frasco conta de onde vêm suas notas.", created_at: ago(4) }],
    solicitacoes: [],
  };
  store.set(slug, data);
  return data;
}

// ----- leitura ----------------------------------------------------------------

export async function loadPlan(slug: string): Promise<PlanData | null> {
  if (isDemoMode()) { const d = demo(slug); return clone({ brand: d.brand, sections: d.sections, objectives: d.objectives, initiatives: d.initiatives, campaigns: d.campaigns }); }
  const b = (await getBrandBySlug(slug)) as any;
  if (!b) return null;
  const [s, o, i, c] = await Promise.all([
    db.from("brand_home_sections").select("*").eq("brand_id", b.id).order("order_index"),
    db.from("objectives").select("*").eq("brand_id", b.id).order("order_index"),
    db.from("espaco360_initiatives").select("*").eq("brand_id", b.id).order("order_index"),
    db.from("espaco360_campaigns").select("id, title, status, initiative_id").eq("brand_id", b.id).order("created_at", { ascending: false }),
  ]);
  return {
    brand: { id: b.id, name: b.name, slug: b.slug, description: b.description ?? null, primary: b.primary_color ?? null, accent: b.accent_color ?? null, logoUrl: b.logo_url ?? null },
    sections: s.data ?? [], objectives: o.data ?? [], initiatives: i.data ?? [], campaigns: c.data ?? [],
  };
}

export async function listComments(slug: string, sectionId: string): Promise<SectionComment[]> {
  if (isDemoMode()) return clone(demo(slug).comments.filter((c) => c.section_id === sectionId));
  const { data } = await db.from("brand_section_comments").select("*").eq("section_id", sectionId).order("created_at");
  return data ?? [];
}

export async function listVersions(slug: string, sectionId: string): Promise<SectionVersion[]> {
  if (isDemoMode()) return clone(demo(slug).versions.filter((v) => v.section_id === sectionId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data } = await db.from("brand_section_versions").select("*").eq("section_id", sectionId).order("created_at", { ascending: false }).limit(40);
  return data ?? [];
}

export const listTemplatesForPlan = async (): Promise<PlanTemplate[]> => (await listPlans()).filter((t) => t.active);

// ----- escrita ----------------------------------------------------------------

async function me() {
  if (isDemoMode()) return "Helena Duarte";
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) return null;
  const { data: p } = await db.from("profiles").select("display_name, email").eq("id", id).maybeSingle();
  return p?.display_name ?? p?.email ?? null;
}

/** Salva os campos e grava uma versão por campo alterado (antes/depois). */
export async function saveSection(slug: string, section: BrandHomeSection, fields: SectionField[]) {
  const before = fieldsOf(section);
  const changed = fields.filter((f) => (before.find((b) => b.key === f.key)?.value ?? "") !== (f.value ?? ""));
  const author = await me();
  const rows = changed.map((f) => ({ brand_id: section.brand_id, section_id: section.id, author_name: author, field_key: f.key, field_label: f.label, before_value: before.find((b) => b.key === f.key)?.value ?? null, after_value: f.value ?? null }));
  if (isDemoMode()) {
    const d = demo(slug);
    d.sections = d.sections.map((s) => (s.id === section.id ? { ...s, fields: clone(fields) as never, updated_at: now() } : s));
    d.versions.push(...rows.map((r) => ({ ...r, id: uid("v"), created_at: now() })));
    return changed.map((f) => f.key);
  }
  await updateSectionFields(section.id, fields);
  if (rows.length) await db.from("brand_section_versions").insert(rows).then(() => undefined, () => undefined);
  return changed.map((f) => f.key);
}

export async function addSection(slug: string, brandId: string, stage: string, title: string, order: number) {
  const fields: SectionField[] = [{ key: "texto", label: "Texto", type: "texto_longo", value: "" }];
  if (isDemoMode()) { demo(slug).sections.push({ id: uid("s"), brand_id: brandId, stage, section_key: newFieldKey(title), title, order_index: order, fields: fields as never, created_at: now(), updated_at: now() }); return; }
  await createSection({ brand_id: brandId, stage, section_key: newFieldKey(title), title, order_index: order } as never);
}

export async function addComment(slug: string, section: BrandHomeSection, body: string) {
  const author = await me();
  if (isDemoMode()) { demo(slug).comments.push({ id: uid("cm"), section_id: section.id, author_name: author, body, created_at: now() }); return; }
  const { error } = await db.from("brand_section_comments").insert({ brand_id: section.brand_id, section_id: section.id, author_name: author, body });
  if (error) throw error;
}

/** Cliente sugere uma alteração: vira uma Solicitação no Espaço 360. */
export async function suggestChange(slug: string, section: BrandHomeSection, text: string) {
  const title = `Sugestão no Plano: ${section.title}`;
  if (isDemoMode()) { demo(slug).solicitacoes.push({ id: uid("so"), title, description: text, created_at: now() }); return; }
  await createSolicitacao({ brand_id: section.brand_id, title, description: text, tipo: "plano", status: "nova", priority: "media" } as never);
}

/** Armazenamento do exemplo compartilhado com o Espaço 360 (mesmos objetivos, estratégias e campanhas). */
export const demoPlanStore = (slug: string) => demo(slug);

export const demoSuggestions = (slug: string) => (isDemoMode() ? clone(demo(slug).solicitacoes) : []);

/** Aplica um modelo: cria só as seções que faltam; nada preenchido é tocado. */
export async function applyTemplate(slug: string, template: PlanTemplate, brandId: string): Promise<number> {
  if (!isDemoMode()) return applyTemplateToBrand(template, brandId);
  const d = demo(slug);
  const taken = new Set(d.sections.map((s) => `${s.stage}:${s.section_key}`));
  let added = 0;
  for (const st of template.stages) {
    const stage = resolveBrandStage(st.key);
    for (const sc of st.sections) {
      if (taken.has(`${stage}:${sc.key}`)) continue;
      d.sections.push({ id: uid("s"), brand_id: brandId, stage, section_key: sc.key, title: sc.title, order_index: d.sections.length, fields: sc.fields.map((f) => ({ ...f, value: "" })) as never, created_at: now(), updated_at: now() });
      added++;
    }
  }
  return added;
}

export async function saveObjective(slug: string, brandId: string, id: string | null, patch: Partial<Objective> & { title: string }) {
  if (isDemoMode()) {
    const d = demo(slug);
    if (id) d.objectives = d.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o));
    else d.objectives.push({ id: uid("o"), brand_id: brandId, description: null, period_type: "mensal", period_label: null, target_value: null, current_value: null, unit: null, status: "planejado", order_index: d.objectives.length, created_at: now(), updated_at: now(), ...patch });
    return;
  }
  if (id) await updateObjective(id, patch as never);
  else await createObjective({ brand_id: brandId, ...patch } as never);
}

export async function saveInitiative(slug: string, brandId: string, id: string | null, patch: Partial<Initiative> & { title: string }) {
  if (isDemoMode()) {
    const d = demo(slug);
    if (id) d.initiatives = d.initiatives.map((i) => (i.id === id ? { ...i, ...patch } : i));
    else d.initiatives.push({ id: uid("in"), brand_id: brandId, description: null, objective_id: null, priority: "curto_prazo", status: "em_andamento", semester: null, order_index: d.initiatives.length, created_at: now(), updated_at: now(), ...patch });
    return;
  }
  if (id) await updateInitiative(id, patch as never);
  else await createInitiative({ brand_id: brandId, ...patch } as never);
}
