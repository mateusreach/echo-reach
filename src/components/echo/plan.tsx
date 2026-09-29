// ---------------------------------------------------------------------------
// Echo · Plano estratégico da marca
// Mesmo componente no Brand (equipe edita) e no Espaço 360 (cliente vê e sugere).
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, Badge, Button, EmptyState, ProgressRing, Skeleton, type Tone } from "./primitives";
import { Chip, Field, LineTabs, Segmented, Select, TextArea } from "./controls";
import { Modal } from "./overlays";
import { Icon, type IconName } from "./icon";
import { stagger } from "./motion";
import { INITIATIVE_STATUSES, OBJECTIVE_PERIODS, OBJECTIVE_STATUSES, PRIORITIES, STAGES, strategyProgress, type BrandHomeSection, type Initiative, type Objective, type SectionField } from "@/lib/reach-data";
import { relDay } from "@/lib/home-data";
import { loadLibrary } from "@/lib/library-data";
import { loadIdentity } from "@/lib/brand-settings-data";
import {
  addComment, addSection, applyTemplate, fieldsOf, listComments, listTemplatesForPlan, listVersions, loadPlan, saveInitiative, saveObjective, saveSection, stageProgress, suggestChange,
  type PlanData,
} from "@/lib/plan-data";

export type PlanTab = "fundacao" | "objetivos" | "estrategia" | "estudos";
export const PLAN_TABS: PlanTab[] = ["fundacao", "objetivos", "estrategia", "estudos"];
const FOUNDATION = STAGES.filter((s) => s.key !== "conhecimento");
const OBJ_TONE: Record<string, Tone> = { planejado: "todo", em_andamento: "doing", atingido: "done", nao_atingido: "late" };
const INI_TONE: Record<string, Tone> = { em_andamento: "doing", concluida: "done", nao_concluida: "late" };
const label = (list: readonly { key: string; label: string }[], k?: string | null) => list.find((x) => x.key === k)?.label ?? k ?? "";

export function PlanView({ slug, tab, onTab, canEdit, canSuggest, spaceLinks }: { slug: string; tab: PlanTab; onTab: (t: PlanTab) => void; canEdit: boolean; canSuggest: boolean; spaceLinks?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["plan", slug], queryFn: () => loadPlan(slug) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["plan", slug] });
  if (q.isLoading) return <div className="stack-lg" aria-busy="true"><Skeleton h={46} r={14} /><Skeleton h={260} r={24} /><Skeleton h={220} r={24} /></div>;
  if (!q.data) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar o plano" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>;
  const d = q.data;
  const studies = d.sections.filter((s) => s.stage === "conhecimento");
  const sp = strategyProgress(d.initiatives);
  return (
    <div className="stack-lg">
      <div className="plan-summary e-glass">
        <ProgressRing value={stageProgress(d.sections.filter((s) => s.stage !== "conhecimento")).percent} size={56} label="Fundação" />
        <div className="e-grow" style={{ minWidth: 0 }}>
          <b>{d.brand.name}</b>
          <p className="e-small" style={{ margin: "2px 0 0" }}>{d.brand.description ?? "Fundação, objetivos, estratégias e estudos que orientam campanhas e produção."}</p>
        </div>
        <div className="plan-kpis">
          <span><b className="tnum">{d.objectives.filter((o) => o.status === "atingido").length}/{d.objectives.length}</b>objetivos atingidos</span>
          <span><b className="tnum">{sp.percent}%</b>das estratégias concluídas</span>
        </div>
      </div>
      <LineTabs<PlanTab> value={tab} onChange={onTab} items={[
        { value: "fundacao", label: "Fundação", icon: "layers" },
        { value: "objetivos", label: `Objetivos · ${d.objectives.length}`, icon: "target" },
        { value: "estrategia", label: `Estratégia · ${d.initiatives.length}`, icon: "compass" },
        { value: "estudos", label: `Estudos · ${studies.length}`, icon: "chart" },
      ]} />
      {tab === "fundacao" && <Foundation slug={slug} d={d} canEdit={canEdit} canSuggest={canSuggest} onChanged={refresh} />}
      {tab === "estudos" && <Sections slug={slug} d={d} sections={studies} stage="conhecimento" canEdit={canEdit} canSuggest={canSuggest} onChanged={refresh} empty="Estudos de estrutura da marca, mercado, tendências, referências e maturidade aparecem aqui." />}
      {tab === "objetivos" && <Objectives slug={slug} d={d} canEdit={canEdit} onChanged={refresh} />}
      {tab === "estrategia" && <Strategies slug={slug} d={d} canEdit={canEdit} onChanged={refresh} spaceLinks={spaceLinks} />}
    </div>
  );
}

// ----- Fundação --------------------------------------------------------------------

function Foundation({ slug, d, canEdit, canSuggest, onChanged }: { slug: string; d: PlanData; canEdit: boolean; canSuggest: boolean; onChanged: () => void }) {
  const custom = [...new Set(d.sections.map((s) => s.stage))].filter((k) => !STAGES.some((s) => s.key === k));
  const stages = [...FOUNDATION.map((s) => ({ key: s.key as string, label: s.label as string, description: s.description as string })), ...custom.map((k) => ({ key: k, label: k.replace(/_/g, " "), description: "" }))];
  const [stage, setStage] = useState(stages[0].key);
  const [applying, setApplying] = useState(false);
  const cur = stages.find((s) => s.key === stage) ?? stages[0];
  const sections = d.sections.filter((s) => s.stage === stage);
  return (
    <div className="stack">
      <div className="stage-tabs" role="tablist" aria-label="Etapas do plano">
        {stages.map((s) => {
          const p = stageProgress(d.sections.filter((x) => x.stage === s.key));
          return (
            <button key={s.key} type="button" role="tab" aria-selected={stage === s.key} className="stage-tab" onClick={() => setStage(s.key)}>
              <span className="stage-name">{s.label}</span>
              <span className="stage-bar"><i style={{ ["--v" as string]: `${p.percent}%` }} /></span>
              <span className="e-caption tnum">{p.total ? `${p.done}/${p.total} ${p.required ? "obrigatórios" : "campos"}` : "sem campos"}</span>
            </button>
          );
        })}
      </div>
      {cur.description && <p className="e-small" style={{ margin: 0 }}>{cur.description}</p>}
      {stage === "acabamento" && (
        <div className="plan-link e-glass">
          <Icon name="palette" />
          <span className="e-grow"><b>Identidade visual</b><span className="e-caption" style={{ display: "block" }}>Paleta, canais, formatos e modelos de peça ficam nas configurações do cliente.</span></span>
          <Link to={`/b/${slug}/configuracoes?tab=identidade` as never} className="e-btn secondary sm">Abrir identidade</Link>
        </div>
      )}
      <Sections slug={slug} d={d} sections={sections} stage={stage} canEdit={canEdit} canSuggest={canSuggest} onChanged={onChanged} empty="Nenhuma seção nesta etapa ainda." />
      {canEdit && <div><Button variant="secondary" icon="layers" onClick={() => setApplying(true)}>Aplicar modelo de plano</Button></div>}
      <ApplyModal open={applying} slug={slug} d={d} onClose={() => setApplying(false)} onDone={onChanged} />
    </div>
  );
}

function Sections({ slug, d, sections, stage, canEdit, canSuggest, onChanged, empty }: { slug: string; d: PlanData; sections: BrandHomeSection[]; stage: string; canEdit: boolean; canSuggest: boolean; onChanged: () => void; empty: string }) {
  const [adding, setAdding] = useState("");
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { if (list.current) stagger(list.current.querySelectorAll(".plan-section"), { y: 8, dur: 380 }, 40); }, [stage]);
  return (
    <div className="stack" ref={list}>
      {sections.map((s) => <PlanSection key={s.id} slug={slug} d={d} section={s} canEdit={canEdit} canSuggest={canSuggest} onChanged={onChanged} />)}
      {sections.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="layers" title="Nada por aqui" text={empty} /></div>}
      {canEdit && (
        <form className="e-row" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); if (!adding.trim()) return; await addSection(slug, d.brand.id, stage, adding.trim(), sections.length); setAdding(""); toast.success("Seção criada"); onChanged(); }}>
          <input className="e-input sm e-grow" value={adding} placeholder="Nova seção nesta etapa" aria-label="Título da nova seção" onChange={(e) => setAdding(e.target.value)} />
          <Button size="sm" variant="secondary" icon="plus" type="submit" disabled={!adding.trim()}>Adicionar seção</Button>
        </form>
      )}
    </div>
  );
}

// ----- Seção -------------------------------------------------------------------------

function useRefOptions(slug: string, brandId: string, type: string, enabled: boolean) {
  return useQuery({
    queryKey: ["plan-ref", slug, type],
    enabled: enabled && ["pilares", "categorias", "canais"].includes(type),
    staleTime: 60_000,
    queryFn: async () => {
      if (type === "canais") return (await loadIdentity(slug, brandId)).channels.map((c) => c.name);
      const lib = await loadLibrary(slug);
      return type === "pilares" ? (lib?.pilares ?? []).map((p) => p.name) : (lib?.categorias ?? []).map((c) => c.name);
    },
  });
}

function FieldEdit({ f, slug, brandId, onChange }: { f: SectionField; slug: string; brandId: string; onChange: (v: string) => void }) {
  const refs = useRefOptions(slug, brandId, f.type, true);
  const multi = new Set(f.value ? f.value.split(",").map((v) => v.trim()).filter(Boolean) : []);
  const toggle = (o: string) => { const n = new Set(multi); if (n.has(o)) n.delete(o); else n.add(o); onChange([...n].join(", ")); };
  switch (f.type) {
    case "texto_longo": case "textarea": return <TextArea label={f.label} rows={4} value={f.value} help={f.help ?? undefined} onChange={(e) => onChange(e.target.value)} />;
    case "lista": return <TextArea label={f.label} rows={4} value={f.value} help={f.help ?? "Um item por linha."} onChange={(e) => onChange(e.target.value)} />;
    case "numero": return <Field label={f.label} type="number" value={f.value} help={f.help ?? undefined} onChange={(e) => onChange(e.target.value)} />;
    case "data": return <Field label={f.label} type="date" value={f.value} onChange={(e) => onChange(e.target.value)} />;
    case "sim_nao": return <div className="e-field"><span className="e-field-label">{f.label}</span><Segmented value={f.value || "nao_informado"} label={f.label} onChange={(v) => onChange(v === "nao_informado" ? "" : v)} items={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }, { value: "nao_informado", label: "—" }]} /></div>;
    case "escala": {
      const opts = f.options?.length ? f.options : ["1", "2", "3", "4", "5"];
      return <div className="e-field"><span className="e-field-label">{f.label}</span><div className="scale-pick" role="radiogroup" aria-label={f.label}>{opts.map((o) => <button key={o} type="button" role="radio" aria-checked={f.value === o} onClick={() => onChange(f.value === o ? "" : o)}>{o}</button>)}</div></div>;
    }
    case "selecao": return <Select label={f.label} value={f.value} placeholder="Escolha" onChange={onChange} options={[{ value: "", label: "—" }, ...(f.options ?? []).map((o) => ({ value: o, label: o }))]} />;
    case "selecao_multipla": case "pilares": case "categorias": case "canais": {
      const opts = [...new Set([...(f.type === "selecao_multipla" ? f.options ?? [] : refs.data ?? []), ...multi])];
      return <div className="e-field"><span className="e-field-label">{f.label}</span><div className="e-row wrap" style={{ gap: 6 }}>{opts.map((o) => <Chip key={o} pressed={multi.has(o)} onClick={() => toggle(o)}>{o}</Chip>)}{opts.length === 0 && <span className="e-caption">{refs.isLoading ? "Carregando…" : "Nenhuma opção cadastrada."}</span>}</div></div>;
    }
    case "imagem": case "image": case "arquivo": case "file": return <Field label={f.label} icon="link" value={f.value} placeholder="https://" help="Endereço do arquivo." onChange={(e) => onChange(e.target.value)} />;
    default: return <Field label={f.label} value={f.value} help={f.help ?? undefined} onChange={(e) => onChange(e.target.value)} />;
  }
}

function FieldShow({ f }: { f: SectionField }) {
  const v = String(f.value ?? "").trim();
  if (!v) return <span className="plan-empty">{f.required ? "Obrigatório · não preenchido" : "Não preenchido"}</span>;
  switch (f.type) {
    case "lista": return <ul className="plan-list">{v.split("\n").filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul>;
    case "selecao_multipla": case "pilares": case "categorias": case "canais": return <span className="e-row wrap" style={{ gap: 4 }}>{v.split(",").map((x) => <span key={x} className="member-tag">{x.trim()}</span>)}</span>;
    case "escala": return <span className="scale-show" aria-label={`${v} de ${f.options?.length || 5}`}>{(f.options?.length ? f.options : ["1", "2", "3", "4", "5"]).map((o) => <i key={o} className={Number(o) <= Number(v) ? "on" : ""} />)}<b className="tnum">{v}</b></span>;
    case "sim_nao": return <span>{v === "sim" ? "Sim" : "Não"}</span>;
    case "data": return <span className="tnum">{v.split("-").reverse().join("/")}</span>;
    case "imagem": case "image": return <img className="plan-img" src={v} alt={f.label} />;
    case "arquivo": case "file": return <a className="e-link" href={v} target="_blank" rel="noreferrer"><Icon name="paperclip" size="sm" /> Abrir arquivo</a>;
    default: return <p className="plan-text">{v}</p>;
  }
}

function PlanSection({ slug, d, section, canEdit, canSuggest, onChanged }: { slug: string; d: PlanData; section: BrandHomeSection; canEdit: boolean; canSuggest: boolean; onChanged: () => void }) {
  const [edit, setEdit] = useState<SectionField[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string[]>([]);
  const [panel, setPanel] = useState<"comentarios" | "historico" | null>(null);
  const [suggest, setSuggest] = useState(false);
  const fields = fieldsOf(section);
  const p = stageProgress([section]);
  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const changed = await saveSection(slug, section, edit);
      setEdit(null);
      if (changed.length) { toast.success("Seção salva", { description: `${changed.length} ${changed.length === 1 ? "campo alterado" : "campos alterados"}` }); setFlash(changed); window.setTimeout(() => setFlash([]), 1600); }
      onChanged();
    } catch { toast.error("Não foi possível salvar."); } finally { setSaving(false); }
  };
  return (
    <section className={`plan-section e-glass${edit ? " editing" : ""}`}>
      <header className="plan-section-head">
        <div className="e-grow" style={{ minWidth: 0 }}>
          <h3 className="e-h3" style={{ margin: 0 }}>{section.title}</h3>
          <span className="e-caption tnum">{p.total ? `${p.done} de ${p.total} ${p.required ? "obrigatórios" : "campos"} preenchidos` : "Sem campos"} · atualizada {relDay(section.updated_at.slice(0, 10)).toLowerCase()}</span>
        </div>
        {!edit && canEdit && <Button size="sm" variant="secondary" icon="edit" onClick={() => setEdit(structuredClone(fields))}>Editar</Button>}
        {!edit && canSuggest && <Button size="sm" variant="secondary" icon="message" onClick={() => setSuggest(true)}>Sugerir alteração</Button>}
      </header>
      {edit ? (
        <div className="plan-fields editing">
          {edit.map((f, i) => <div key={f.key} className={f.type === "texto_longo" || f.type === "lista" || f.type === "textarea" ? "wide" : ""}><FieldEdit f={f} slug={slug} brandId={d.brand.id} onChange={(v) => setEdit(edit.map((x, j) => (j === i ? { ...x, value: v } : x)))} /></div>)}
          <div className="plan-actions wide"><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button icon="check" loading={saving} onClick={save}>Salvar</Button></div>
        </div>
      ) : (
        <dl className="plan-fields">
          {fields.map((f) => (
            <div key={f.key} className={`${f.type === "texto_longo" || f.type === "lista" || f.type === "textarea" ? "wide" : ""}${flash.includes(f.key) ? " flash" : ""}`}>
              <dt>{f.label}{f.required && <span className="req" title="Obrigatório">•</span>}</dt>
              <dd><FieldShow f={f} /></dd>
            </div>
          ))}
        </dl>
      )}
      {canEdit && !edit && (
        <footer className="plan-section-foot">
          <button type="button" className={`plan-toggle${panel === "comentarios" ? " on" : ""}`} onClick={() => setPanel(panel === "comentarios" ? null : "comentarios")}><Icon name="message" size="sm" /> Comentários da equipe</button>
          <button type="button" className={`plan-toggle${panel === "historico" ? " on" : ""}`} onClick={() => setPanel(panel === "historico" ? null : "historico")}><Icon name="history" size="sm" /> Histórico</button>
        </footer>
      )}
      {panel === "comentarios" && <Comments slug={slug} section={section} />}
      {panel === "historico" && <Versions slug={slug} section={section} />}
      <SuggestModal open={suggest} section={section} onClose={() => setSuggest(false)} onSend={async (text) => { await suggestChange(slug, section, text); toast.success("Sugestão enviada", { description: "A equipe recebe como solicitação no Espaço 360." }); setSuggest(false); }} />
    </section>
  );
}

function Comments({ slug, section }: { slug: string; section: BrandHomeSection }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["plan-comments", section.id], queryFn: () => listComments(slug, section.id) });
  const [text, setText] = useState("");
  const send = async () => { if (!text.trim()) return; await addComment(slug, section, text.trim()); setText(""); qc.invalidateQueries({ queryKey: ["plan-comments", section.id] }); };
  return (
    <div className="plan-panel">
      {(q.data ?? []).map((c) => <div key={c.id} className="plan-comment"><Avatar name={c.author_name ?? "Equipe"} size="sm" /><div><b>{c.author_name ?? "Equipe"}</b> <span className="e-caption">{relDay(c.created_at.slice(0, 10)).toLowerCase()}</span><p>{c.body}</p></div></div>)}
      {q.data?.length === 0 && <span className="e-caption">Nenhum comentário ainda. Só a equipe vê.</span>}
      <form className="e-row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input className="e-input sm e-grow" value={text} placeholder="Comentar para a equipe" aria-label="Comentário" onChange={(e) => setText(e.target.value)} />
        <Button size="sm" icon="send" type="submit" disabled={!text.trim()} aria-label="Enviar comentário" />
      </form>
    </div>
  );
}

function Versions({ slug, section }: { slug: string; section: BrandHomeSection }) {
  const q = useQuery({ queryKey: ["plan-versions", section.id, section.updated_at], queryFn: () => listVersions(slug, section.id) });
  return (
    <div className="plan-panel">
      {(q.data ?? []).length === 0 ? <span className="e-caption">Nenhuma alteração registrada ainda.</span> : (
        <ol className="hub-activity">
          {q.data!.map((v) => (
            <li key={v.id}>
              <span className="node" style={{ ["--c" as string]: "var(--env-brand)" }}><Icon name="edit" size="sm" /></span>
              <div>
                <b>{v.author_name ?? "Alguém"}</b> <span>alterou {v.field_label ?? "um campo"}</span>
                <div className="e-caption">{relDay(v.created_at.slice(0, 10))}</div>
                <div className="diff"><del>{v.before_value || "vazio"}</del><ins>{v.after_value || "vazio"}</ins></div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SuggestModal({ open, section, onClose, onSend }: { open: boolean; section: BrandHomeSection; onClose: () => void; onSend: (t: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setText(""); }, [open]);
  return (
    <Modal open={open} onClose={onClose} icon="message" title="Sugerir alteração" sub={section.title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button icon="send" loading={busy} disabled={text.trim().length < 5} onClick={async () => { setBusy(true); try { await onSend(text.trim()); } catch { toast.error("Não foi possível enviar."); } finally { setBusy(false); } }}>Enviar à equipe</Button></>}>
      <TextArea label="O que você mudaria?" rows={5} max={1200} value={text} autoFocus help="A equipe recebe como uma solicitação e responde por lá." onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

function ApplyModal({ open, slug, d, onClose, onDone }: { open: boolean; slug: string; d: PlanData; onClose: () => void; onDone: () => void }) {
  const q = useQuery({ queryKey: ["plan-templates-active"], queryFn: listTemplatesForPlan, enabled: open });
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const t = q.data?.find((x) => x.id === id);
  const existing = new Set(d.sections.map((s) => s.section_key));
  const news = t ? t.stages.flatMap((s) => s.sections).filter((s) => !existing.has(s.key)).length : 0;
  return (
    <Modal open={open} onClose={onClose} icon="layers" title="Aplicar modelo de plano" sub="Cria só as seções que faltam. Nada preenchido é alterado."
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!t} onClick={async () => { if (!t) return; setBusy(true); try { const n = await applyTemplate(slug, t, d.brand.id); toast.success(n ? `${n} ${n === 1 ? "seção criada" : "seções criadas"}` : "Nenhuma seção nova", { description: "Os campos já preenchidos continuam como estavam." }); onDone(); onClose(); } catch { toast.error("Não foi possível aplicar."); } finally { setBusy(false); } }}>Aplicar</Button></>}>
      <div className="e-stack" style={{ gap: 10 }}>
        <Select label="Modelo" value={id} placeholder={q.isLoading ? "Carregando…" : "Escolha um modelo"} onChange={setId} options={(q.data ?? []).map((x) => ({ value: x.id, label: x.name }))} />
        {t && <p className="e-small" style={{ margin: 0 }}>{t.stages.length} etapas · {t.stages.reduce((n, s) => n + s.sections.length, 0)} seções no modelo · <b>{news}</b> {news === 1 ? "será criada" : "serão criadas"} neste cliente.</p>}
      </div>
    </Modal>
  );
}

// ----- Objetivos ----------------------------------------------------------------------

function Objectives({ slug, d, canEdit, onChanged }: { slug: string; d: PlanData; canEdit: boolean; onChanged: () => void }) {
  const [edit, setEdit] = useState<(Partial<Objective> & { title: string }) | null>(null);
  return (
    <div className="stack">
      {canEdit && <div><Button icon="plus" onClick={() => setEdit({ title: "", period_type: "mensal", status: "planejado" })}>Novo objetivo</Button></div>}
      {OBJECTIVE_PERIODS.map((per) => {
        const list = d.objectives.filter((o) => o.period_type === per.key);
        if (!list.length) return null;
        return (
          <div key={per.key} className="stack">
            <span className="e-label">{per.plural}</span>
            <div className="obj-grid">
              {list.map((o) => {
                const pct = o.target_value ? Math.min(100, Math.round(((o.current_value ?? 0) / o.target_value) * 100)) : 0;
                return (
                  <button key={o.id} type="button" className="obj-card e-glass" disabled={!canEdit} onClick={() => setEdit({ ...o })}>
                    <div className="e-row between" style={{ gap: 8 }}><span className="e-caption">{o.period_label ?? per.label}</span><Badge tone={OBJ_TONE[o.status] ?? "todo"} dot>{label(OBJECTIVE_STATUSES, o.status)}</Badge></div>
                    <b>{o.title}</b>
                    {o.target_value != null && <>
                      <div className={`e-bar sm ${o.status === "nao_atingido" ? "danger" : pct >= 100 ? "ok" : ""}`}><i style={{ ["--v" as string]: `${pct}%` }} /></div>
                      <span className="e-caption tnum">{(o.current_value ?? 0).toLocaleString("pt-BR")} de {o.target_value.toLocaleString("pt-BR")} {o.unit ?? ""} · {pct}%</span>
                    </>}
                    <span className="e-caption">{d.initiatives.filter((i) => i.objective_id === o.id).length} estratégias ligadas</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {d.objectives.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState icon="target" title="Nenhum objetivo ainda" text="Objetivos anuais, trimestrais e mensais com meta e valor atual." /></div>}
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="target" title={edit?.id ? "Editar objetivo" : "Novo objetivo"}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit?.title.trim()} onClick={async () => { if (!edit) return; const { id, created_at: _c, updated_at: _u, brand_id: _b, ...patch } = edit as any; await saveObjective(slug, d.brand.id, id ?? null, { ...patch, title: edit.title.trim() }); toast.success("Objetivo salvo"); setEdit(null); onChanged(); }}>Salvar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 10 }}>
          <Field label="Objetivo" autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <div className="grid-2" style={{ gap: 10 }}>
            <Select label="Período" value={edit.period_type ?? "mensal"} onChange={(v) => setEdit({ ...edit, period_type: v })} options={OBJECTIVE_PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
            <Field label="Rótulo do período" optional placeholder="Ex.: 4º tri 2026" value={edit.period_label ?? ""} onChange={(e) => setEdit({ ...edit, period_label: e.target.value || null })} />
            <Field label="Meta" type="number" optional value={edit.target_value ?? ""} onChange={(e) => setEdit({ ...edit, target_value: e.target.value === "" ? null : Number(e.target.value) })} />
            <Field label="Valor atual" type="number" optional value={edit.current_value ?? ""} onChange={(e) => setEdit({ ...edit, current_value: e.target.value === "" ? null : Number(e.target.value) })} />
            <Field label="Unidade" optional placeholder="seguidores, %, vendas" value={edit.unit ?? ""} onChange={(e) => setEdit({ ...edit, unit: e.target.value || null })} />
            <Select label="Status" value={edit.status ?? "planejado"} onChange={(v) => setEdit({ ...edit, status: v })} options={OBJECTIVE_STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
          </div>
        </div>}
      </Modal>
    </div>
  );
}

// ----- Estratégias --------------------------------------------------------------------

function Strategies({ slug, d, canEdit, onChanged, spaceLinks }: { slug: string; d: PlanData; canEdit: boolean; onChanged: () => void; spaceLinks?: boolean }) {
  const [edit, setEdit] = useState<(Partial<Initiative> & { title: string }) | null>(null);
  const sp = strategyProgress(d.initiatives);
  const icon: Record<string, IconName> = { em_andamento: "loader", concluida: "checkCircle", nao_concluida: "xCircle" };
  return (
    <div className="stack">
      <div className="plan-summary e-glass">
        <ProgressRing value={sp.percent} size={56} label="Estratégias" />
        <div className="plan-kpis" style={{ flex: 1 }}>
          <span><b className="tnum">{sp.done}</b>concluídas</span><span><b className="tnum">{sp.running}</b>em andamento</span><span><b className="tnum" style={{ color: sp.missed ? "var(--danger)" : undefined }}>{sp.missed}</b>não concluídas</span>
        </div>
        {canEdit && <Button icon="plus" onClick={() => setEdit({ title: "", priority: "curto_prazo", status: "em_andamento" })}>Nova estratégia</Button>}
      </div>
      {d.initiatives.map((i) => {
        const obj = d.objectives.find((o) => o.id === i.objective_id);
        const camps = d.campaigns.filter((c) => c.initiative_id === i.id);
        return (
          <article key={i.id} className="ini-card e-glass">
            <span className={`ini-ic ${i.status}`}><Icon name={icon[i.status] ?? "circle"} size="sm" /></span>
            <div className="e-grow" style={{ minWidth: 0 }}>
              <div className="e-row wrap" style={{ gap: 6 }}><b>{i.title}</b><Badge tone={INI_TONE[i.status] ?? "todo"}>{label(INITIATIVE_STATUSES, i.status)}</Badge><Badge tone="glass">{label(PRIORITIES, i.priority)}</Badge></div>
              {i.description && <p className="e-small" style={{ margin: "4px 0 0" }}>{i.description}</p>}
              <div className="e-row wrap" style={{ gap: 6, marginTop: 8 }}>
                {obj && <span className="e-caption"><Icon name="target" size="sm" /> {obj.title}</span>}
                {camps.map((c) => spaceLinks
                  ? <Link key={c.id} to="/e360/$brandSlug/campanha/$campaignId" params={{ brandSlug: slug, campaignId: c.id }} search={{ tab: undefined, filtro: undefined } as never} className="member-tag"><Icon name="megaphone" size="sm" /> {c.title}</Link>
                  : <span key={c.id} className="member-tag"><Icon name="megaphone" size="sm" /> {c.title}</span>)}
                {camps.length === 0 && <span className="e-caption">Sem campanhas derivadas</span>}
              </div>
            </div>
            {canEdit && <Button size="sm" variant="ghost" icon="edit" aria-label={`Editar ${i.title}`} onClick={() => setEdit({ ...i })} />}
          </article>
        );
      })}
      {d.initiatives.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState icon="compass" title="Nenhuma estratégia ainda" text="Estratégias ligam objetivos às campanhas e à produção." /></div>}
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="compass" title={edit?.id ? "Editar estratégia" : "Nova estratégia"}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit?.title.trim()} onClick={async () => { if (!edit) return; const { id, created_at: _c, updated_at: _u, brand_id: _b, ...patch } = edit as any; await saveInitiative(slug, d.brand.id, id ?? null, { ...patch, title: edit.title.trim() }); toast.success("Estratégia salva"); setEdit(null); onChanged(); }}>Salvar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 10 }}>
          <Field label="Estratégia" autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <TextArea label="Descrição" optional rows={3} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value || null })} />
          <div className="grid-2" style={{ gap: 10 }}>
            <Select label="Horizonte" value={edit.priority ?? "curto_prazo"} onChange={(v) => setEdit({ ...edit, priority: v })} options={PRIORITIES.map((p) => ({ value: p.key, label: p.label }))} />
            <Select label="Status" value={edit.status ?? "em_andamento"} onChange={(v) => setEdit({ ...edit, status: v })} options={INITIATIVE_STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
          </div>
          <Select label="Objetivo" value={edit.objective_id ?? ""} placeholder="Nenhum" onChange={(v) => setEdit({ ...edit, objective_id: v || null })} options={[{ value: "", label: "Nenhum" }, ...d.objectives.map((o) => ({ value: o.id, label: o.title }))]} />
        </div>}
      </Modal>
    </div>
  );
}
