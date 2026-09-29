import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FINA_SLUG = "fina-fragrancia";

/**
 * Recupera o cliente histórico na organização da pessoa administradora que
 * executa a ação. É idempotente: reaproveita uma Fina existente, completa
 * apenas títulos ausentes e não remove registros de nenhuma organização.
 */
export const restoreFinaFragrancia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: caller } = await (supabaseAdmin as any)
      .from("profiles")
      .select("organization_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!caller?.organization_id) throw new Error("Sua conta não está vinculada a uma agência.");

    const { data: roles } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("organization_id", caller.organization_id);
    if (!(roles ?? []).some((row: { role: string }) => row.role === "agency_admin")) {
      throw new Error("Somente administradores podem restaurar um cliente histórico.");
    }

    const { data: agencyBrands, error: brandLookupError } = await (supabaseAdmin as any)
      .from("brands")
      .select("id, name, slug, modules")
      .eq("organization_id", caller.organization_id);
    if (brandLookupError) throw new Error(`Não foi possível consultar os clientes da agência: ${brandLookupError.message}`);
    const found = (agencyBrands ?? []).find((brand: { name: string; slug: string }) =>
      brand.slug === FINA_SLUG || ["fina fragrância", "fina fragrancia"].includes(brand.name.toLocaleLowerCase("pt-BR")),
    );

    let brandId = found?.id as string | undefined;
    let brandSlug = (found?.slug as string | undefined) ?? FINA_SLUG;
    if (brandId) {
      const { error } = await (supabaseAdmin as any)
        .from("brands")
        .update({ modules: { ...(found.modules ?? {}), biblioteca: true, plano: false, workspace: true, espaco360: true } })
        .eq("id", brandId);
      if (error) throw new Error(`Não foi possível habilitar o espaço da Fina: ${error.message}`);
    } else {
      const { data: slugInUse, error: slugError } = await (supabaseAdmin as any)
        .from("brands")
        .select("id")
        .eq("slug", FINA_SLUG)
        .maybeSingle();
      if (slugError) throw new Error(`Não foi possível verificar o cadastro da Fina: ${slugError.message}`);
      if (slugInUse) brandSlug = `${FINA_SLUG}-${String(caller.organization_id).slice(0, 8)}`;
      const { data, error } = await (supabaseAdmin as any)
        .from("brands")
        .insert({
          organization_id: caller.organization_id,
          name: "Fina Fragrância",
          slug: brandSlug,
          segment: "Perfumaria artesanal & cosmética · Betim/MG",
          description: "Uma loja para criar, sentir e cuidar.",
          status: "ativo",
          modules: { biblioteca: true, plano: false, workspace: true, espaco360: true },
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Não foi possível criar a Fina Fragrância: ${error?.message ?? "erro desconhecido"}`);
      brandId = data.id;
    }

    const insertMissing = async (table: string, rows: Record<string, unknown>[], key: string) => {
      const { data: existing, error } = await (supabaseAdmin as any).from(table).select(key).eq("brand_id", brandId);
      if (error) throw new Error(error.message);
      const known = new Set((existing ?? []).map((row: Record<string, string>) => row[key]));
      const missing = rows.filter((row) => !known.has(String(row[key])));
      if (missing.length) {
        const { error: insertError } = await (supabaseAdmin as any).from(table).insert(missing);
        if (insertError) throw new Error(insertError.message);
      }
    };

    await insertMissing("brand_home_sections", [
      { brand_id: brandId, stage: "minha_empresa", section_key: "fina_empresa", title: "Fina Fragrância", order_index: 0, fields: [{ key: "descricao_institucional", label: "Descrição institucional", type: "textarea", value: "Uma loja para criar, sentir e cuidar. Especialista em perfumaria artesanal, cosmética, velas, sabonetes e aromatização em Betim/MG." }] },
      { brand_id: brandId, stage: "alicerce", section_key: "fina_proposito", title: "Propósito e posicionamento", order_index: 0, fields: [{ key: "proposito", label: "Propósito", type: "textarea", value: "Capacitar pessoas a transformar o cuidado com o lar e o corpo em experiências de criação, bem-estar e autonomia." }, { key: "posicionamento", label: "Posicionamento 2026", type: "textarea", value: "Uma loja para criar, sentir e cuidar: o lugar onde se aprende a criar, perfumar e cuidar." }] },
      { brand_id: brandId, stage: "estrutura", section_key: "fina_territorios", title: "Territórios e personalidade", order_index: 0, fields: [{ key: "arquetipos", label: "Arquétipos", type: "text", value: "Criador (principal) · Sábio (secundário)" }, { key: "valores", label: "Valores", type: "textarea", value: "Criação · Sensorialidade · Cuidado · Conhecimento" }] },
      { brand_id: brandId, stage: "comunicacao", section_key: "fina_narrativa", title: "Direção de comunicação", order_index: 0, fields: [{ key: "pilares_editoriais", label: "Pilares editoriais", type: "textarea", value: "Criar · Perfumar / Sentir · Cuidar · Empreender com Aromas · Conhecimento e Técnica" }] },
    ], "section_key");

    const initiatives = [
      "Cursos caros com tráfego para leads", "Copa com MaxBio", "Material de apresentação institucional da loja", "Grupo de Curso Comunidade de Curadoria", "Cartão de aniversário / Experiência na loja", "Fracionamento de produtos", "Lives de Novidades na loja", "Catálogo Digital - Loja Online", "Workshops Gratuitos", "Lançamentos Perfumaria Nova", "Exposição de produtos na loja", "Moeda Fragrância", "Kit essências para troca com caixa personalizada", "Treinamento da Equipe", "Cursos por área de produtos vendidos na loja", "Bônus para trabalhadores da região", "Presskit para lojistas (bodysplash)", "Embalagem para kits ao longo do ano", "Essência da Loja",
    ];
    await insertMissing("espaco360_initiatives", initiatives.map((title, order_index) => ({ brand_id: brandId, title, order_index, status: title === "Fracionamento de produtos" ? "concluida" : "em_andamento", priority: "sem_prioridade", semester: "A definir" })), "title");

    await insertMissing("espaco360_campaigns", [
      ["12 anos criando, perfumando e cuidando", "2026-04-01", "2026-04-10", "Autoridade e história da marca", "Kits de aniversário"],
      ["Prepare seus produtos para vender no Dia das Mães", "2026-04-08", "2026-05-01", "Empreendedorismo artesanal", "Kits para produzir e vender"],
      ["Aromas que viram presente", "2026-05-01", "2026-05-11", "Conversão no Dia das Mães", "Kits presenteáveis"],
      ["Crie experiências para o Dia dos Namorados", "2026-05-13", "2026-06-01", "Antecipar produção dos clientes", "Kits românticos"],
      ["Experiências que começam com um aroma", "2026-06-01", "2026-06-12", "Dia dos Namorados", "Kits e curadoria de fragrâncias"],
      ["Casa Aconchegante", "2026-06-15", "2026-07-01", "Território de inverno", "Aromatizadores e velas para o lar"],
    ].map(([title, start_date, end_date, description, message]) => ({ brand_id: brandId, title, start_date, end_date, description, message, status: "planejada", stage: "planejamento", priority: "sem_prioridade", quarter: "Q2 2026" })), "title");

    await insertMissing("espaco360_channels", [
      { brand_id: brandId, name: "Instagram", status: "ativo", description: "Canal principal de narrativa e conteúdo educativo", order_index: 0 },
      { brand_id: brandId, name: "WhatsApp", status: "ativo", description: "Atendimento, pedidos e relacionamento", order_index: 1 },
      { brand_id: brandId, name: "Loja física", status: "ativo", description: "Betim/MG — experiência, curadoria e atendimento especialista", order_index: 2 },
    ], "name");

    const { error: archiveError } = await (supabaseAdmin as any)
      .rpc("restore_fina_fragrancia_archive", { p_brand_id: brandId });
    if (archiveError) throw new Error(`Não foi possível completar o plano histórico da Fina: ${archiveError.message}`);
    const { error: rosterError } = await (supabaseAdmin as any)
      .rpc("provision_reach_client_roster", { p_organization_id: caller.organization_id });
    if (rosterError) throw new Error(`Não foi possível completar os clientes da agência: ${rosterError.message}`);

    return { brandId, slug: brandSlug, restored: true };
  });
