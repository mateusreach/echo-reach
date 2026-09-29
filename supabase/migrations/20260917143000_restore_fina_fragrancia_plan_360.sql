-- Restaura o conteúdo de referência da Fina Fragrância no modelo relacional
-- do Reach OS. A origem foi preservada em src/lib/brand-data.ts durante a
-- reconstrução do produto, mas as rotas atuais leem estas tabelas do banco.
--
-- A migração é aditiva e idempotente: ela só acrescenta registros ausentes e
-- nunca atualiza ou remove decisões, campanhas ou dados já cadastrados pela
-- equipe da Fina Fragrância.

DO $$
DECLARE
  v_brand_id uuid;
  v_meeting_id uuid;
BEGIN
  SELECT id
    INTO v_brand_id
  FROM public.brands
  WHERE slug = 'fina-fragrancia'
     OR lower(name) IN ('fina fragrância', 'fina fragrancia')
  ORDER BY created_at
  LIMIT 1;

  IF v_brand_id IS NULL THEN
    RAISE NOTICE 'Fina Fragrância não encontrada; restauração não aplicada.';
    RETURN;
  END IF;

  -- Plano: seções que alimentam Fundação e Estratégia.
  INSERT INTO public.brand_home_sections (brand_id, stage, section_key, title, order_index, fields)
  SELECT v_brand_id, source.stage, source.section_key, source.title, source.order_index, source.fields
  FROM (
    VALUES
      (
        'minha_empresa', 'fina_empresa', 'Fina Fragrância', 0,
        jsonb_build_array(
          jsonb_build_object('key', 'descricao_institucional', 'label', 'Descrição institucional', 'type', 'textarea', 'value', 'Uma loja para criar, sentir e cuidar. Especialista em perfumaria artesanal, cosmética, velas, sabonetes e aromatização em Betim/MG.'),
          jsonb_build_object('key', 'segmento', 'label', 'Segmento', 'type', 'text', 'value', 'Perfumaria artesanal & cosmética · Betim/MG')
        )
      ),
      (
        'alicerce', 'fina_proposito', 'Propósito e posicionamento', 0,
        jsonb_build_array(
          jsonb_build_object('key', 'proposito', 'label', 'Propósito', 'type', 'textarea', 'value', 'Capacitar pessoas a transformar o cuidado com o lar e o corpo em experiências de criação, bem-estar e autonomia — entregando conhecimento, matéria-prima e inspiração para criar cosméticos, velas, sabonetes e aromatizadores.'),
          jsonb_build_object('key', 'essencia', 'label', 'Essência', 'type', 'text', 'value', 'Criar experiências através dos aromas.'),
          jsonb_build_object('key', 'posicionamento', 'label', 'Posicionamento 2026', 'type', 'textarea', 'value', 'Uma loja para criar, sentir e cuidar: de loja de essências para o lugar onde se aprende a criar, perfumar e cuidar.')
        )
      ),
      (
        'estrutura', 'fina_territorios', 'Territórios e personalidade', 0,
        jsonb_build_array(
          jsonb_build_object('key', 'arquetipos', 'label', 'Arquétipos', 'type', 'textarea', 'value', 'Criador (principal) · Sábio (secundário)'),
          jsonb_build_object('key', 'personalidade', 'label', 'Personalidade', 'type', 'textarea', 'value', 'Acolhedora · Criativa · Especialista · Prática · Inspiradora'),
          jsonb_build_object('key', 'valores', 'label', 'Valores', 'type', 'textarea', 'value', 'Criação · Sensorialidade · Cuidado · Conhecimento'),
          jsonb_build_object('key', 'territorios', 'label', 'Territórios de valor', 'type', 'textarea', 'value', 'Economia doméstica · Empreendedorismo artesanal · Experiência sensorial')
        )
      ),
      (
        'comunicacao', 'fina_narrativa', 'Direção de comunicação', 0,
        jsonb_build_array(
          jsonb_build_object('key', 'pilares_editoriais', 'label', 'Pilares editoriais', 'type', 'textarea', 'value', 'Criar (25%) · Perfumar / Sentir (20%) · Cuidar (20%) · Empreender com Aromas (20%) · Conhecimento e Técnica (15%)'),
          jsonb_build_object('key', 'tom_de_voz', 'label', 'Tom de voz', 'type', 'textarea', 'value', 'Didático e acessível · Acolhedor e próximo · Confiante e experiente · Inspirador'),
          jsonb_build_object('key', 'formatos_fixos', 'label', 'Formatos fixos', 'type', 'textarea', 'value', 'Receita da Semana · Essência da Semana · Dica Fina · Ideia para Criar · Produtos que Vendem Muito · Bastidores da #FF · Pergunta do Cliente · Explorando Fragrâncias · Antes e Depois · Criação dos Clientes')
        )
      )
  ) AS source(stage, section_key, title, order_index, fields)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brand_home_sections existing
    WHERE existing.brand_id = v_brand_id AND existing.section_key = source.section_key
  );

  -- Espaço 360: estratégias/iniciativas do Plano 360 de 2026.
  INSERT INTO public.espaco360_initiatives (brand_id, title, status, priority, semester, description, order_index)
  SELECT v_brand_id, source.title, source.status, 'sem_prioridade', source.semester, source.description, source.order_index
  FROM (
    VALUES
      ('Cursos caros com tráfego para leads', 'em_andamento', 'A definir', NULL, 0),
      ('Copa com MaxBio', 'em_andamento', 'A definir', NULL, 1),
      ('Material de apresentação institucional da loja', 'em_andamento', 'A definir', NULL, 2),
      ('Grupo de Curso Comunidade de Curadoria', 'em_andamento', 'A definir', NULL, 3),
      ('Cartão de aniversário / Experiência na loja', 'em_andamento', '2º semestre 2026', NULL, 4),
      ('Fracionamento de produtos', 'concluida', 'A definir', NULL, 5),
      ('Lives de Novidades na loja', 'em_andamento', 'A definir', NULL, 6),
      ('Catálogo Digital - Loja Online', 'em_andamento', 'A definir', NULL, 7),
      ('Workshops Gratuitos', 'em_andamento', 'A definir', NULL, 8),
      ('Lançamentos Perfumaria Nova', 'em_andamento', '1º semestre 2026', 'Lançamento de produto/kit', 9),
      ('Exposição de produtos na loja', 'em_andamento', 'A definir', NULL, 10),
      ('Moeda Fragrância', 'em_andamento', 'A definir', 'Sistema de fidelização/troca', 11),
      ('Kit essências para troca com caixa personalizada', 'em_andamento', 'A definir', NULL, 12),
      ('Treinamento da Equipe', 'em_andamento', 'A definir', NULL, 13),
      ('Cursos por área de produtos vendidos na loja', 'em_andamento', 'A definir', 'Workshops gratuitos, custo apenas dos kits usados', 14),
      ('Bônus para trabalhadores da região', 'em_andamento', 'A definir', NULL, 15),
      ('Presskit para lojistas (bodysplash)', 'em_andamento', 'A definir', NULL, 16),
      ('Embalagem para kits ao longo do ano', 'em_andamento', 'A definir', NULL, 17),
      ('Essência da Loja', 'em_andamento', 'A definir', 'Produto de marca própria', 18)
  ) AS source(title, status, semester, description, order_index)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.espaco360_initiatives existing
    WHERE existing.brand_id = v_brand_id AND existing.title = source.title
  );

  -- Calendário de campanhas Q2 2026. Datas abertas no material-fonte foram
  -- convertidas para o início do próximo período, para permanecerem editáveis.
  INSERT INTO public.espaco360_campaigns (
    brand_id, title, start_date, end_date, status, stage, priority, quarter, description, message
  )
  SELECT v_brand_id, source.title, source.start_date, source.end_date, 'planejada', 'planejamento', 'sem_prioridade', 'Q2 2026', source.objective, source.action
  FROM (
    VALUES
      ('12 anos criando, perfumando e cuidando', DATE '2026-04-01', DATE '2026-04-10', 'Autoridade e história da marca', 'Kits de aniversário'),
      ('Prepare seus produtos para vender no Dia das Mães', DATE '2026-04-08', DATE '2026-05-01', 'Empreendedorismo artesanal', 'Kits para produzir e vender'),
      ('Aromas que viram presente', DATE '2026-05-01', DATE '2026-05-11', 'Conversão no Dia das Mães', 'Kits presenteáveis'),
      ('Crie experiências para o Dia dos Namorados', DATE '2026-05-13', DATE '2026-06-01', 'Antecipar produção dos clientes', 'Kits românticos'),
      ('Experiências que começam com um aroma', DATE '2026-06-01', DATE '2026-06-12', 'Dia dos Namorados', 'Kits e curadoria de fragrâncias'),
      ('Casa Aconchegante', DATE '2026-06-15', DATE '2026-07-01', 'Território de inverno', 'Aromatizadores e velas para o lar')
  ) AS source(title, start_date, end_date, objective, action)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.espaco360_campaigns existing
    WHERE existing.brand_id = v_brand_id AND existing.title = source.title
  );

  INSERT INTO public.espaco360_channels (brand_id, name, status, description, order_index)
  SELECT v_brand_id, source.name, 'ativo', source.description, source.order_index
  FROM (
    VALUES
      ('Instagram', 'Canal principal de narrativa e conteúdo educativo', 0),
      ('WhatsApp', 'Atendimento, pedidos e relacionamento', 1),
      ('Loja física', 'Betim/MG — experiência, curadoria e atendimento especialista', 2)
  ) AS source(name, description, order_index)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.espaco360_channels existing
    WHERE existing.brand_id = v_brand_id AND existing.name = source.name
  );

  INSERT INTO public.espaco360_monthly_tracking (
    brand_id, month_ref, decisoes_tomadas, insights, ponto_atencao, resultados_internos
  )
  SELECT v_brand_id, source.month_ref, source.decisoes, source.insights, source.atencao, source.resultados
  FROM (
    VALUES
      ('2026-01', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda'),
      ('2026-02', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda'),
      ('2026-03', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda'),
      ('2026-04', 'Lançar a campanha de 12 anos e antecipar os kits do Dia das Mães.', 'O cliente valoriza a narrativa de autoridade e a história da marca.', 'Dependência do atendimento manual via WhatsApp nos picos.', 'Aumento de fluxo na loja física e alta procura pelos kits de aniversário.'),
      ('2026-05', 'Priorizar kits presenteáveis e iniciar a comunicação de Dia dos Namorados em 13/05.', 'Kits prontos convertem melhor que itens avulsos para quem compra para presentear.', 'Falta de produtos de entrada padronizados limita o ticket inicial.', 'Melhor desempenho de conteúdo nos quadros Ideia para Criar e Produtos que Vendem Muito.'),
      ('2026-06', 'Emendar Dia dos Namorados com o território de inverno (Casa Aconchegante).', 'Aroma associado a memória afetiva sustenta as duas campanhas na mesma narrativa.', 'Estoque de essências sazonais e prazo de embalagens personalizadas.', 'Crescimento de aromatizadores e velas; base de WhatsApp mais engajada.'),
      ('2026-07', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda'),
      ('2026-08', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda'),
      ('2026-09', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda'),
      ('2026-10', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda'),
      ('2026-11', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda'),
      ('2026-12', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda', 'Sem registro ainda')
  ) AS source(month_ref, decisoes, insights, atencao, resultados)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.espaco360_monthly_tracking existing
    WHERE existing.brand_id = v_brand_id AND existing.month_ref = source.month_ref
  );

  -- Reuniões e tarefas vinculadas, igualmente sem substituir registros criados depois.
  INSERT INTO public.espaco360_meetings (brand_id, title, meeting_date, participants, notes)
  SELECT v_brand_id, source.title, source.meeting_date, source.participants, source.notes
  FROM (
    VALUES
      ('Kickoff Campanha 12 Anos', DATE '2026-03-24', jsonb_build_array('Reach', 'Direção Fina Fragrância'), 'Decisões: Aprovar o conceito 12 anos criando, perfumando e cuidando e os kits de aniversário. Responsáveis: Reach (criação) · Loja (produção dos kits).'),
      ('Alinhamento Dia das Mães', DATE '2026-04-06', jsonb_build_array('Reach', 'Equipe de loja'), 'Decisões: Antecipar a comunicação para empreendedoras a partir de 08/04 com kits para produzir e vender. Responsáveis: Loja (estoque) · Reach (conteúdo).'),
      ('Planejamento Junho / Inverno', DATE '2026-05-18', jsonb_build_array('Reach', 'Direção Fina Fragrância'), 'Decisões: Emendar Dia dos Namorados com o território Casa Aconchegante. Responsáveis: Reach (calendário) · Loja (curadoria).')
  ) AS source(title, meeting_date, participants, notes)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.espaco360_meetings existing
    WHERE existing.brand_id = v_brand_id AND existing.title = source.title
  );

  SELECT id INTO v_meeting_id FROM public.espaco360_meetings
  WHERE brand_id = v_brand_id AND title = 'Kickoff Campanha 12 Anos' LIMIT 1;
  IF v_meeting_id IS NOT NULL THEN
    INSERT INTO public.espaco360_meeting_tasks (meeting_id, brand_id, description, due_date, assignee, status)
    SELECT v_meeting_id, v_brand_id, source.description, source.due_date, source.assignee, source.status
    FROM (VALUES
      ('Fechar composição dos kits de aniversário', DATE '2026-03-31', 'Loja', 'concluida'),
      ('Produzir peças da campanha de 12 anos', DATE '2026-04-01', 'Reach', 'concluida')
    ) AS source(description, due_date, assignee, status)
    WHERE NOT EXISTS (SELECT 1 FROM public.espaco360_meeting_tasks existing WHERE existing.meeting_id = v_meeting_id AND existing.description = source.description);
  END IF;

  SELECT id INTO v_meeting_id FROM public.espaco360_meetings
  WHERE brand_id = v_brand_id AND title = 'Alinhamento Dia das Mães' LIMIT 1;
  IF v_meeting_id IS NOT NULL THEN
    INSERT INTO public.espaco360_meeting_tasks (meeting_id, brand_id, description, due_date, assignee, status)
    SELECT v_meeting_id, v_brand_id, source.description, source.due_date, source.assignee, source.status
    FROM (VALUES
      ('Definir mix dos kits para vender no Dia das Mães', DATE '2026-04-10', 'Loja', 'concluida'),
      ('Roteirizar conteúdos Aromas que viram presente', DATE '2026-04-28', 'Reach', 'em_andamento')
    ) AS source(description, due_date, assignee, status)
    WHERE NOT EXISTS (SELECT 1 FROM public.espaco360_meeting_tasks existing WHERE existing.meeting_id = v_meeting_id AND existing.description = source.description);
  END IF;

  SELECT id INTO v_meeting_id FROM public.espaco360_meetings
  WHERE brand_id = v_brand_id AND title = 'Planejamento Junho / Inverno' LIMIT 1;
  IF v_meeting_id IS NOT NULL THEN
    INSERT INTO public.espaco360_meeting_tasks (meeting_id, brand_id, description, due_date, assignee, status)
    SELECT v_meeting_id, v_brand_id, source.description, source.due_date, source.assignee, source.status
    FROM (VALUES
      ('Orçar embalagens personalizadas para junho', DATE '2026-05-22', 'Loja', 'em_andamento'),
      ('Montar curadoria de aromas de inverno', DATE '2026-06-05', 'Reach + Loja', 'a_fazer')
    ) AS source(description, due_date, assignee, status)
    WHERE NOT EXISTS (SELECT 1 FROM public.espaco360_meeting_tasks existing WHERE existing.meeting_id = v_meeting_id AND existing.description = source.description);
  END IF;
END;
$$;
