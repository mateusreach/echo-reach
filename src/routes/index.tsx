import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { goToLogin } from "@/lib/login-redirect";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/echo/icon";
import { EchoLogo, OrbitLoader, type EchoLogoHandle } from "@/components/echo/logo";
import { Badge, Button, EmptyState, ProgressRing, Skeleton } from "@/components/echo/primitives";
import { DemoBanner, EchoTopbar, ENVS, type CommandItem } from "@/components/echo/shell";
import { stagger, useCountUp, enter } from "@/components/echo/motion";
import { isDemoMode, loadHome, relDay, type EnvSummary, type HomeData, type HomeItem } from "@/lib/home-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Echo" },
      { name: "description", content: "Brand, Workspace, Like e Espaço 360: a plataforma da Reach." },
      { property: "og:title", content: "Echo · Reach" },
      { property: "og:description", content: "O que precisa de atenção hoje, em todos os ambientes." },
    ],
  }),
  component: EchoHome,
});

const DEMO_ROLE_KEY = "echo.demo-role";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
function longDate() {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

function EchoHome() {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [demoRole, setDemoRole] = useState<"team" | "client">("team");
  // Os dados dependem da sessão do navegador: a consulta só começa depois de montar no cliente.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const r = sessionStorage.getItem(DEMO_ROLE_KEY); if (r === "client" || r === "team") setDemoRole(r); } catch { /* sessão indisponível */ }
    setReady(true);
  }, []);
  const qc = useQueryClient();
  const changeRole = (r: "team" | "client") => { setDemoRole(r); try { sessionStorage.setItem(DEMO_ROLE_KEY, r); } catch { /* ok */ } qc.invalidateQueries({ queryKey: ["echo-session"] }); };

  const q = useQuery({ queryKey: ["echo-home", demo ? demoRole : "live"], queryFn: () => loadHome(demoRole), enabled: ready, staleTime: 30_000, retry: 1 });

  useEffect(() => { if (q.data === "unauthenticated") goToLogin(navigate as never); }, [q.data, navigate]);

  const data = q.data && q.data !== "unauthenticated" ? q.data : null;
  const person = data?.person ?? { name: "", firstName: "" };
  const availability = data ? Object.fromEntries(data.envs.map((e) => [e.id, { available: e.available, reason: e.reason }])) : undefined;

  const commands: CommandItem[] = [];
  if (data?.team) {
    const seen = new Set<string>();
    [...data.team.myTasks, ...data.team.requests, ...data.team.waitingClient].forEach((it) => {
      if (it.client && !seen.has(it.client)) { seen.add(it.client); commands.push({ id: `c-${it.client}`, group: "Clientes", label: it.client, icon: "briefcase", run: () => navigate({ to: "/clientes" as never }) }); }
    });
  }

  return (
    <div className="echo-app">
      <EchoTopbar
        person={{ name: person.name || (q.isLoading ? "…" : "Você") }}
        envAvailability={availability}
        commands={commands}
        onSignOut={demo ? undefined : async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
      />
      <main className="echo-home">
        {demo && <DemoBanner role={demoRole} onRole={changeRole} />}
        {!ready || q.isLoading || q.data === "unauthenticated" ? (
          <HomeSkeleton />
        ) : q.isError || !data ? (
          <div className="e-glass" style={{ borderRadius: "var(--r-2xl)", marginTop: 24 }}>
            <EmptyState kind="error" title="Não foi possível carregar a Home" text="A conexão com o banco falhou. Seus dados estão seguros; tente de novo em instantes." actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} />
          </div>
        ) : (
          <HomeContent data={data} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function HomeContent({ data }: { data: HomeData }) {
  const root = useRef<HTMLDivElement>(null);
  const logo = useRef<EchoLogoHandle>(null);

  // Entrada orquestrada só na primeira abertura da sessão; a marca ecoa uma vez por dia.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let firstInSession = true;
    try { firstInSession = !sessionStorage.getItem("echo.home-intro"); sessionStorage.setItem("echo.home-intro", "1"); } catch { /* ok */ }
    if (firstInSession) {
      stagger(el.querySelectorAll(".home-hero > div > *"), { y: 14, blur: 6, dur: 700 }, 80);
      enter(el.querySelector(".home-mark"), { y: 10, scale: 0.94, blur: 8, dur: 800, delay: 120 });
      stagger(el.querySelectorAll(".env-card"), { y: 18, scale: 0.98, blur: 4, dur: 600, delay: 260 }, 70);
      stagger(el.querySelectorAll(".now-panel"), { y: 14, dur: 520, delay: 480 }, 60);
    }
    const today = new Date().toDateString();
    let played = false;
    try { played = localStorage.getItem("echo.home-logo") === today; localStorage.setItem("echo.home-logo", today); } catch { /* ok */ }
    if (!played) window.setTimeout(() => logo.current?.play(), 700);
  }, [data.role]);

  const isClient = data.role === "client";
  const lead = isClient ? clientLead(data) : teamLead(data);

  return (
    <div ref={root}>
      <section className="home-hero">
        <div>
          <span className="e-label">{longDate()}{isClient && data.client ? ` · ${data.client.brand.name}` : ""}</span>
          <h1 className="e-display home-title">{greeting()},<br /><em className="e-grad-text">{data.person.firstName || "bem-vindo"}.</em></h1>
          <p className="home-lead">{lead}</p>
        </div>
        <span className="home-mark e-echo-host" title="Echo">
          <EchoLogo ref={logo} />
        </span>
      </section>

      <section className={`home-envs n-${data.envs.length}`} aria-label="Ambientes">
        {data.envs.map((e) => <EnvCard key={e.id} env={e} />)}
      </section>

      <div className="home-section-head">
        <h2 className="e-h3">Agora</h2>
        <span className="e-caption">{isClient ? "O que depende de você e o que vem por aí." : "O que precisa da sua atenção, em todos os clientes."}</span>
      </div>
      {isClient ? <ClientNow data={data} /> : <TeamNow data={data} />}

      {data.isAdmin && (
        <nav className="home-admin" aria-label="Administração do ecossistema">
          <span className="e-label">Administração</span>
          {[["/clientes", "Clientes", "briefcase"], ["/agencia/equipe", "Equipe", "users"], ["/agencia/modelos", "Modelos", "layers"], ["/agencia/configuracoes", "Configurações", "sliders"]].map(([to, l, ic]) => (
            <Link key={to} to={to as never} className="e-chip"><Icon name={ic} size="sm" />{l}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}

function teamLead(d: HomeData) {
  const t = d.team!;
  const parts: string[] = [];
  if (t.myTasksTotal) parts.push(`${t.myTasksTotal} ${t.myTasksTotal === 1 ? "tarefa vence" : "tarefas vencem"} até hoje`);
  if (t.waitingClient.length) parts.push(`${t.waitingClient.length} ${t.waitingClient.length === 1 ? "material espera" : "materiais esperam"} o cliente`);
  if (t.coverage.length) parts.push(`${t.coverage.length} ${t.coverage.length === 1 ? "frente precisa" : "frentes precisam"} de conteúdo`);
  if (!parts.length) return "Tudo em dia. Nenhuma tarefa vencendo, nenhum cliente sem cobertura.";
  const last = parts.pop();
  return (parts.length ? `${parts.join(", ")} e ${last}` : last!).replace(/^./, (c) => c.toUpperCase()) + ".";
}
function clientLead(d: HomeData) {
  const c = d.client!;
  if (c.toDecide.length) return `Há ${c.toDecide.length} ${c.toDecide.length === 1 ? "material" : "materiais"} para você decidir. O primeiro vence ${relDay(c.toDecide[0].due).toLowerCase()}.`;
  return "Nenhum material aguardando sua decisão. Acompanhe abaixo o plano e os próximos compromissos.";
}

// ---------------------------------------------------------------------------

function EnvCard({ env }: { env: EnvSummary }) {
  const def = ENVS.find((e) => e.id === env.id)!;
  const n = useCountUp(env.count);
  const body = (
    <>
      <span className="env-glow" aria-hidden="true" />
      <div className="env-top">
        <span className="env-ic"><Icon name={def.icon} size="md" /></span>
        {env.available ? <Icon name="arrowUpRight" className="env-arrow" /> : <Badge tone="glass" icon="lock">{env.reason ?? "Indisponível"}</Badge>}
      </div>
      <div>
        <h3 className="env-name">{def.name}</h3>
        <p className="env-tag">{def.tagline}</p>
      </div>
      <div className="env-num">
        <span className="e-kpi tnum">{n}</span>
        <span className="env-lbl">{env.label}{env.sub && <small>{env.sub}</small>}</span>
      </div>
    </>
  );
  const style = { ["--c" as string]: def.color };
  return env.available && env.href ? (
    <Link to={env.href as never} className="env-card e-glass" style={style}>{body}</Link>
  ) : (
    <div className="env-card e-glass is-locked" style={style} aria-disabled="true">{body}</div>
  );
}

// ---------------------------------------------------------------------------

function Panel({ title, icon, count, children, foot, wide, tone }: { title: string; icon: string; count?: number; children: ReactNode; foot?: ReactNode; wide?: boolean; tone?: string }) {
  return (
    <section className={`now-panel e-glass${wide ? " wide" : ""}`} style={tone ? ({ "--c": tone } as React.CSSProperties) : undefined}>
      <header>
        <span className="now-ic"><Icon name={icon} size="sm" /></span>
        <h3>{title}</h3>
        {count !== undefined && <span className="e-badge glass tnum">{count}</span>}
      </header>
      <div className="now-body">{children}</div>
      {foot && <footer>{foot}</footer>}
    </section>
  );
}

function Row({ it }: { it: HomeItem }) {
  const inner = (
    <>
      <span className={`now-dot ${it.tone ?? "ok"}`} aria-hidden="true" />
      <span className="now-main">
        <b className="e-ellipsis">{it.title}</b>
        <span className="e-ellipsis">{it.meta}</span>
      </span>
      <span className="now-side">
        {it.due !== undefined && <span className={`now-due tone-${it.tone ?? "ok"}`}>{relDay(it.due)}</span>}
        {it.badge && <Badge tone={it.badge.tone} dot>{it.badge.label}</Badge>}
      </span>
    </>
  );
  return it.href ? <Link to={it.href as never} className="now-row">{inner}</Link> : <div className="now-row">{inner}</div>;
}

function List({ items, empty }: { items: HomeItem[]; empty: ReactNode }) {
  if (!items.length) return <>{empty}</>;
  return <div className="now-list">{items.map((it) => <Row key={it.id} it={it} />)}</div>;
}

function TeamNow({ data }: { data: HomeData }) {
  const t = data.team!;
  const all = t.myTasks.length + t.waitingClient.length + t.coverage.length + t.requests.length;
  if (!all)
    return (
      <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}>
        <EmptyState kind="ok" title="Tudo em dia" text="Nenhuma tarefa vencendo, nenhum material parado com o cliente e todas as frentes cobertas." />
      </div>
    );
  return (
    <div className="home-now">
      <Panel title="Minhas para hoje" icon="checkCircle" count={t.myTasksTotal} tone="var(--env-workspace)"
        foot={<Link to={"/workspace/agenda" as never} className="e-link">Abrir minha agenda <Icon name="arrowRight" size="sm" /></Link>}>
        <List items={t.myTasks} empty={<EmptyState kind="ok" compact title="Nada vencendo hoje" text="Suas próximas tarefas estão na Minha agenda." />} />
      </Panel>
      <Panel title="Aguardando o cliente" icon="heart" count={t.waitingClient.length} tone="var(--env-like)"
        foot={<span className="e-caption"><Icon name="info" size="sm" /> Em breve o cliente decide pelo Like.</span>}>
        <List items={t.waitingClient} empty={<EmptyState kind="ok" compact title="Nenhum material parado" text="Nada em avaliação externa há mais de 2 dias." />} />
      </Panel>
      <Panel title="Cobertura em risco" icon="feed" count={t.coverage.length} tone="var(--danger)"
        foot={<Link to={"/workspace/controle" as never} className="e-link">Abrir controle de cobertura <Icon name="arrowRight" size="sm" /></Link>}>
        <List items={t.coverage} empty={<EmptyState kind="ok" compact title="Todas as frentes cobertas" text="Nenhum cliente sem post à vista." />} />
      </Panel>
      <Panel title="Solicitações novas" icon="message" count={t.requests.length} tone="var(--env-360)"
        foot={<Link to={"/e360" as never} className="e-link">Abrir Espaço 360 <Icon name="arrowRight" size="sm" /></Link>}>
        <List items={t.requests} empty={<EmptyState kind="ok" compact title="Nenhuma solicitação nova" text="Os clientes não abriram pedidos desde a última triagem." />} />
      </Panel>
    </div>
  );
}

function ClientNow({ data }: { data: HomeData }) {
  const c = data.client!;
  return (
    <div className="home-now">
      <Panel title="Para você decidir" icon="heart" count={c.toDecide.length} wide tone="var(--env-like)"
        foot={c.toDecide.length ? (<><Button icon="play" disabled title="O Like está em construção">Começar revisão</Button><span className="e-caption">A tela de revisão chega com o Like.</span></>) : undefined}>
        <List items={c.toDecide} empty={<EmptyState kind="ok" compact title="Nada para decidir agora" text="Quando a Reach enviar materiais para aprovação, eles aparecem aqui." />} />
      </Panel>
      <Panel title="Progresso do plano" icon="target" tone="var(--env-brand)"
        foot={<Link to={`/e360/${c.brand.slug}/plano` as never} className="e-link">Ver o plano <Icon name="arrowRight" size="sm" /></Link>}>
        <div className="plan-box">
          <ProgressRing value={c.plan.percent} size={84} label="Progresso do plano" />
          <div><b className="tnum">{c.plan.done} de {c.plan.total}</b><span className="e-caption">estratégias concluídas</span></div>
        </div>
      </Panel>
      <Panel title="Próximos compromissos" icon="calendar" count={c.upcoming.length} tone="var(--env-360)">
        <List items={c.upcoming} empty={<EmptyState compact icon="calendar" title="Agenda livre" text="Nenhuma reunião, gravação ou publicação marcada." />} />
      </Panel>
      <Panel title="Suas solicitações" icon="message" count={c.requests.length} tone="var(--env-360)"
        foot={<Link to={`/e360/${c.brand.slug}?tab=Solicitações` as never} className="e-link">Nova solicitação <Icon name="plus" size="sm" /></Link>}>
        <List items={c.requests} empty={<EmptyState compact title="Nenhuma solicitação aberta" text="Peça algo à Reach pelo Espaço 360." />} />
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando a Home">
      <section className="home-hero">
        <div style={{ display: "grid", gap: 14 }}>
          <Skeleton w={180} h={11} />
          <Skeleton w="70%" h={54} r={14} />
          <Skeleton w="55%" h={54} r={14} />
          <Skeleton w="80%" h={14} />
        </div>
        <span className="home-mark" style={{ display: "grid", placeItems: "center" }}><OrbitLoader size={120} label="Carregando a Home" /></span>
      </section>
      <section className="home-envs">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="env-card e-glass" style={{ gap: 18 }}>
            <Skeleton w={44} h={44} r={14} /><Skeleton w="50%" h={16} /><Skeleton w="80%" h={11} /><Skeleton w="40%" h={30} r={8} />
          </div>
        ))}
      </section>
      <div className="home-now" style={{ marginTop: 56 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="now-panel e-glass" style={{ gap: 12 }}>
            <Skeleton w="40%" h={14} />
            {[0, 1, 2].map((k) => <Skeleton key={k} h={44} r={14} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
