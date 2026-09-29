-- Fonte: src/lib/brand-data.ts do ZIP reach-brand (1).zip.
-- Restaura conteúdo textual e registros históricos da Fina Fragrância de forma
-- aditiva. Nunca substitui valores existentes nem inventa URLs de mídia.
-- Os resultados e estados de 2026 são registros do arquivo, não métricas
-- validadas do banco atual.

CREATE OR REPLACE FUNCTION public.restore_fina_fragrancia_archive(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fina_restore$
DECLARE
  v_archive jsonb := $fina_archive$
{
  "sections": [
    {
      "stage": "minha_empresa",
      "section_key": "fina_empresa",
      "title": "Fina Fragrância",
      "order_index": 0,
      "fields": [
        {
          "key": "segmento",
          "label": "Segmento",
          "type": "textarea",
          "value": "Perfumaria artesanal & cosmética · Betim/MG"
        },
        {
          "key": "assinatura",
          "label": "Assinatura",
          "type": "textarea",
          "value": "Feita para quem ama criar, sentir e cuidar."
        },
        {
          "key": "cliente_desde",
          "label": "Histórico com a Reach no arquivo",
          "type": "textarea",
          "value": "Cliente Reach desde 2014 (11-12 anos de mercado)"
        },
        {
          "key": "essencia",
          "label": "Essência",
          "type": "textarea",
          "value": "Criar experiências através dos aromas."
        },
        {
          "key": "conceito_valor",
          "label": "Conceito de valor",
          "type": "textarea",
          "value": "Criar — Sentir — Cuidar"
        }
      ]
    },
    {
      "stage": "alicerce",
      "section_key": "fina_proposito",
      "title": "Propósito e posicionamento",
      "order_index": 0,
      "fields": [
        {
          "key": "proposito_integral_arquivo",
          "label": "Propósito integral do arquivo",
          "type": "textarea",
          "value": "A Fina Fragrância existe para capacitar pessoas a transformar o cuidado com o lar e o corpo em experiências de criação, bem-estar e autonomia — entregando conhecimento, matéria-prima e inspiração para que cada cliente crie seus próprios cosméticos, velas, sabonetes e aromatizadores."
        },
        {
          "key": "posicionamento_integral_arquivo",
          "label": "Posicionamento integral do arquivo",
          "type": "textarea",
          "value": "Posicionamento 2026: “Uma loja para criar, sentir e cuidar” — de “loja de essências” para “o lugar onde se aprende a criar, perfumar e cuidar”."
        },
        {
          "key": "essencia",
          "label": "Essência",
          "type": "textarea",
          "value": "Criar experiências através dos aromas."
        }
      ]
    },
    {
      "stage": "alicerce",
      "section_key": "fina_dna_2026",
      "title": "DNA da marca",
      "order_index": 1,
      "fields": [
        {
          "key": "pilar_dna_1",
          "label": "Criação · 30%",
          "type": "textarea",
          "value": "Colocar a mão na massa: da essência ao produto pronto."
        },
        {
          "key": "pilar_dna_2",
          "label": "Sensorialidade · 25%",
          "type": "textarea",
          "value": "O aroma como memória, ambiente e emoção."
        },
        {
          "key": "pilar_dna_3",
          "label": "Cuidado · 25%",
          "type": "textarea",
          "value": "Cuidar da casa, do corpo e de quem se ama."
        },
        {
          "key": "pilar_dna_4",
          "label": "Conhecimento · 20%",
          "type": "textarea",
          "value": "Ensinar técnica, dosagem e uso com segurança."
        }
      ]
    },
    {
      "stage": "alicerce",
      "section_key": "fina_manifesto_2026",
      "title": "Manifesto da marca",
      "order_index": 2,
      "fields": [
        {
          "key": "paragrafo_1",
          "label": "Parágrafo 1",
          "type": "textarea",
          "value": "Acreditamos que os aromas têm o poder de transformar o cotidiano. Um perfume pode trazer lembranças, criar sensações, marcar momentos e transformar um ambiente inteiro. É por isso que existimos: para que mais pessoas possam criar, sentir e cuidar através dos aromas."
        },
        {
          "key": "paragrafo_2",
          "label": "Parágrafo 2",
          "type": "textarea",
          "value": "A Fina Fragrância nasceu para ser mais do que uma loja. Somos um lugar onde ideias ganham forma, onde uma essência se transforma em um produto, e onde cada pessoa descobre que também pode criar."
        },
        {
          "key": "paragrafo_3",
          "label": "Parágrafo 3",
          "type": "textarea",
          "value": "Aqui, quem chega encontra conhecimento, ingredientes e possibilidades. Porque acreditamos que qualquer pessoa pode aprender a produzir, perfumar sua casa e até transformar isso em uma nova fonte de renda."
        },
        {
          "key": "paragrafo_4",
          "label": "Parágrafo 4",
          "type": "textarea",
          "value": "Criar é experimentar. Sentir é se conectar. Cuidar é transformar o ambiente onde vivemos."
        },
        {
          "key": "paragrafo_5",
          "label": "Parágrafo 5",
          "type": "textarea",
          "value": "Mais do que vender essências, nossa missão é despertar a capacidade de criar."
        },
        {
          "key": "paragrafo_6",
          "label": "Parágrafo 6",
          "type": "textarea",
          "value": "Fina Fragrância. Feita para quem ama criar, sentir e cuidar."
        }
      ]
    },
    {
      "stage": "alicerce",
      "section_key": "fina_personas_2026",
      "title": "Personas",
      "order_index": 3,
      "fields": [
        {
          "key": "persona_1",
          "label": "Empreendedoras da Perfumaria e Cosmética Artesanal",
          "type": "textarea",
          "value": "Mulheres 25-50 que querem criar para vender; valorizam qualidade e orientação técnica."
        },
        {
          "key": "persona_2",
          "label": "Donas de Casa Econômicas",
          "type": "textarea",
          "value": "Mulheres 25-60 que querem economizar produzindo produtos de limpeza em casa."
        },
        {
          "key": "persona_3",
          "label": "Clientes de Aromatização e Perfume para Casa",
          "type": "textarea",
          "value": "Mulheres 25-55 que buscam casa perfumada e experiência sensorial."
        },
        {
          "key": "persona_4",
          "label": "Artesãs Criativas",
          "type": "textarea",
          "value": "Mulheres 20-45 que fazem velas e sabonetes artesanais; buscam diferenciação e tendências."
        },
        {
          "key": "persona_5",
          "label": "Pequenos Empreendedores da Limpeza",
          "type": "textarea",
          "value": "Produzem para vender; buscam custo competitivo e padronização."
        },
        {
          "key": "persona_6",
          "label": "Consumidor Presenteável",
          "type": "textarea",
          "value": "Compra ocasional para presentear; valoriza estética e praticidade."
        }
      ]
    },
    {
      "stage": "estrutura",
      "section_key": "fina_territorios",
      "title": "Territórios e personalidade",
      "order_index": 0,
      "fields": [
        {
          "key": "arquetipos",
          "label": "Arquétipos",
          "type": "textarea",
          "value": "Criador (principal) · Sábio (secundário)"
        },
        {
          "key": "personalidade",
          "label": "Personalidade",
          "type": "textarea",
          "value": "Acolhedora · Criativa · Especialista · Prática · Inspiradora"
        },
        {
          "key": "valores",
          "label": "Valores",
          "type": "textarea",
          "value": "Criação · Sensorialidade · Cuidado · Conhecimento"
        },
        {
          "key": "atributos",
          "label": "Atributos",
          "type": "textarea",
          "value": "Especialista · Educadora · Criativa · Sensorial · Acessível · Prática · Inspiradora"
        },
        {
          "key": "tom_de_voz",
          "label": "Tom de voz",
          "type": "textarea",
          "value": "Didático e acessível · Acolhedor e próximo · Confiante e experiente · Inspirador"
        },
        {
          "key": "territorios",
          "label": "Territórios de valor",
          "type": "textarea",
          "value": "Economia doméstica · Empreendedorismo artesanal · Experiência sensorial"
        },
        {
          "key": "conceito_valor",
          "label": "Conceito de valor",
          "type": "textarea",
          "value": "Criar — Sentir — Cuidar"
        }
      ]
    },
    {
      "stage": "comunicacao",
      "section_key": "fina_narrativa",
      "title": "Direção de comunicação",
      "order_index": 0,
      "fields": [
        {
          "key": "pilar_editorial_1",
          "label": "Criar · 25%",
          "type": "textarea",
          "value": "Ensinar e inspirar a produzir velas, cosméticos, aromatizadores e sabonetes.\nCategorias: Atrair · Ensinar · Inspirar · Converter"
        },
        {
          "key": "pilar_editorial_2",
          "label": "Perfumar / Sentir · 20%",
          "type": "textarea",
          "value": "O poder dos aromas na criação de ambientes e memórias.\nCategorias: Atrair · Ensinar · Inspirar · Converter"
        },
        {
          "key": "pilar_editorial_3",
          "label": "Cuidar · 20%",
          "type": "textarea",
          "value": "Limpeza, bem-estar e cuidado com a casa e a família.\nCategorias: Atrair · Ensinar · Inspirar · Converter"
        },
        {
          "key": "pilar_editorial_4",
          "label": "Empreender com Aromas · 20%",
          "type": "textarea",
          "value": "Transformar a perfumaria artesanal em fonte de renda.\nCategorias: Atrair · Ensinar · Inspirar · Converter"
        },
        {
          "key": "pilar_editorial_5",
          "label": "Conhecimento e Técnica · 15%",
          "type": "textarea",
          "value": "Posicionar a loja como especialista que ensina e orienta.\nCategorias: Atrair · Ensinar · Inspirar · Converter"
        },
        {
          "key": "formatos_fixos",
          "label": "Quadros fixos",
          "type": "textarea",
          "value": "Receita da Semana\nEssência da Semana\nDica Fina\nIdeia para Criar\nProdutos que Vendem Muito\nBastidores da #FF\nPergunta do Cliente\nExplorando Fragrâncias\nAntes e Depois\nCriação dos Clientes"
        },
        {
          "key": "tom_de_voz",
          "label": "Tom de voz",
          "type": "textarea",
          "value": "Didático e acessível · Acolhedor e próximo · Confiante e experiente · Inspirador"
        }
      ]
    },
    {
      "stage": "conhecimento",
      "section_key": "fina_maturidade_2026",
      "title": "Maturidade e evolução da marca",
      "order_index": 1,
      "fields": [
        {
          "key": "nivel_declarado",
          "label": "Nível declarado",
          "type": "textarea",
          "value": "3"
        },
        {
          "key": "titulo",
          "label": "Título",
          "type": "textarea",
          "value": "Nível 3 — Marca Especialista Local"
        },
        {
          "key": "estagio",
          "label": "Estágio",
          "type": "textarea",
          "value": "Especialista Local em Consolidação"
        },
        {
          "key": "escada_maturidade",
          "label": "Escada de maturidade",
          "type": "textarea",
          "value": "1. Loja de insumos — Estágio inicial\n2. Especialista local — ATUAL — em consolidação\n3. Especialista Estruturada — Próximo passo\n4. Autoridade Regional — Médio prazo\n5. Ecossistema Criativo — Expansão\n6. Referência Nacional — Longo prazo"
        },
        {
          "key": "pontos_fortes",
          "label": "Pontos fortes",
          "type": "textarea",
          "value": "Autoridade técnica no segmento\nGrande diversidade de produtos\nAlta margem em essências\nForte relacionamento com clientes\nLoja física bem localizada e reformada\nConteúdo educativo funciona bem"
        },
        {
          "key": "lacunas",
          "label": "Lacunas",
          "type": "textarea",
          "value": "Comunicação ainda pouco estratégica\nFalta de cursos estruturados\nDependência de atendimento manual (WhatsApp)\nFalta de produtos de entrada (kits)\nAusência de sistema de fidelização"
        }
      ]
    },
    {
      "stage": "conhecimento",
      "section_key": "fina_mercado_2026",
      "title": "Mercado e concorrência",
      "order_index": 2,
      "fields": [
        {
          "key": "oportunidade",
          "label": "Oportunidade estratégica",
          "type": "textarea",
          "value": "Posicionar a Fina Fragrância como “a casa de essências que ensina a criar” — misturando loja + conhecimento + experiência."
        },
        {
          "key": "concorrente_1",
          "label": "Big Essências · Referência regional forte",
          "type": "textarea",
          "value": "Forças: E-commerce · Variedade · Autoridade regional · Cursos\nFraquezas: Comunicação pouco sofisticada · Foco em preço · Pouco educativo profundo · Pouca narrativa emocional"
        },
        {
          "key": "concorrente_2",
          "label": "Efraim Betim · Concorrente direto geográfico",
          "type": "textarea",
          "value": "Forças: Localização · Reconhecimento local · Preço\nFraquezas: Comunicação digital fraca · Marca fraca · Baixa autoridade"
        },
        {
          "key": "concorrente_3",
          "label": "Império das Essências · Referência nacional",
          "type": "textarea",
          "value": "Forças: E-commerce forte · Mix completo · Escala · Marca nacional · Marketplace\nFraquezas: Comunicação impessoal · Pouco humana · Falta narrativa local"
        },
        {
          "key": "concorrente_4",
          "label": "Peter · Formador de mercado",
          "type": "textarea",
          "value": "Forças: Autoridade (100 mil alunos) · Conteúdo didático · Comunidade\nFraquezas: Diferencial: vende conhecimento + sonho, não produto"
        }
      ]
    },
    {
      "stage": "conhecimento",
      "section_key": "fina_linha_do_tempo_2026",
      "title": "Linha do tempo",
      "order_index": 3,
      "fields": [
        {
          "key": "marco_1",
          "label": "2014 · Nascimento da Fina Fragrância",
          "type": "textarea",
          "value": "Loja de essências e matérias-primas em Betim/MG."
        },
        {
          "key": "marco_2",
          "label": "2023 · Reforma e nova loja física",
          "type": "textarea",
          "value": "Espaço reposicionado para experiência e curadoria."
        },
        {
          "key": "marco_3",
          "label": "2025 · Conteúdo educativo ganha tração",
          "type": "textarea",
          "value": "Receitas e dicas viram o formato de maior engajamento."
        },
        {
          "key": "marco_4",
          "label": "2026 · Plano Publicitário 360 | 2026",
          "type": "textarea",
          "value": "Reposicionamento: “Uma loja para criar, sentir e cuidar”."
        },
        {
          "key": "marco_5",
          "label": "Abr 2026 · Campanha de 12 anos",
          "type": "textarea",
          "value": "“12 anos criando, perfumando e cuidando” abre o calendário."
        }
      ]
    },
    {
      "stage": "acabamento",
      "section_key": "fina_direcao_criativa_2026",
      "title": "Direção criativa do arquivo",
      "order_index": 1,
      "fields": [
        {
          "key": "direcao_arte",
          "label": "Direção de arte",
          "type": "textarea",
          "value": "Sensorial e acolhedora: luz quente, texturas de vidro e cera, matéria-prima em primeiro plano."
        },
        {
          "key": "templates_conteudo",
          "label": "Templates de conteúdo",
          "type": "textarea",
          "value": "Layouts dedicados aos quadros fixos: Receita da Semana, Essência da Semana e Dica Fina."
        },
        {
          "key": "kits_embalagens",
          "label": "Kits e embalagens",
          "type": "textarea",
          "value": "Sistema visual para kits de aniversário, Dia das Mães, Namorados e caixa personalizada de troca."
        },
        {
          "key": "bastidores",
          "label": "Bastidores da #FF",
          "type": "textarea",
          "value": "Registro da loja, do fracionamento e da equipe — base do território de autoridade técnica."
        }
      ]
    },
    {
      "stage": "conhecimento",
      "section_key": "fina_radar_2026",
      "title": "Radar do arquivo",
      "order_index": 4,
      "fields": [
        {
          "key": "renda_extra",
          "label": "Renda extra com artesanato",
          "type": "textarea",
          "value": "Busca crescente por produzir para vender — reforça o pilar Empreender com Aromas."
        },
        {
          "key": "economia_domestica",
          "label": "Economia doméstica",
          "type": "textarea",
          "value": "Produção caseira de itens de limpeza segue em alta com o aperto no orçamento."
        },
        {
          "key": "video_curto",
          "label": "Conteúdo educativo em vídeo curto",
          "type": "textarea",
          "value": "Receitas e passo a passo continuam sendo o formato de maior alcance no segmento."
        },
        {
          "key": "cursos",
          "label": "Cursos como produto",
          "type": "textarea",
          "value": "Concorrentes e formadores de mercado monetizam conhecimento antes do produto."
        }
      ]
    },
    {
      "stage": "comunicacao",
      "section_key": "fina_roadmap_original_2026",
      "title": "Roadmap do arquivo · campanhas 2026",
      "order_index": 1,
      "fields": [
        {
          "key": "campanha_1_abril_1",
          "label": "12 anos criando, perfumando e cuidando",
          "type": "textarea",
          "value": "Abril · 1 – 10 de abril\nObjetivo: Autoridade e história da marca\nAção: Kits de aniversário"
        },
        {
          "key": "campanha_1_abril_2",
          "label": "Prepare seus produtos para vender no Dia das Mães",
          "type": "textarea",
          "value": "Abril · 8 de abril – início de maio\nObjetivo: Empreendedorismo artesanal\nAção: Kits para produzir e vender"
        },
        {
          "key": "campanha_1_maio_1",
          "label": "Aromas que viram presente",
          "type": "textarea",
          "value": "Maio · 1 – 11 de maio\nObjetivo: Conversão no Dia das Mães\nAção: Kits presenteáveis"
        },
        {
          "key": "campanha_1_maio_2",
          "label": "Crie experiências para o Dia dos Namorados",
          "type": "textarea",
          "value": "Maio · 13 de maio em diante\nObjetivo: Antecipar produção dos clientes\nAção: Kits românticos"
        },
        {
          "key": "campanha_1_junho_1",
          "label": "Experiências que começam com um aroma",
          "type": "textarea",
          "value": "Junho · 1 – 12 de junho\nObjetivo: Dia dos Namorados\nAção: Kits e curadoria de fragrâncias"
        },
        {
          "key": "campanha_1_junho_2",
          "label": "Casa Aconchegante",
          "type": "textarea",
          "value": "Junho · Meados de junho – início de julho\nObjetivo: Território de inverno\nAção: Aromatizadores e velas para o lar"
        },
        {
          "key": "q3",
          "label": "Q3 2026",
          "type": "textarea",
          "value": "Julho – Setembro · aberto no arquivo"
        },
        {
          "key": "q4",
          "label": "Q4 2026",
          "type": "textarea",
          "value": "Outubro – Dezembro · aberto no arquivo"
        }
      ]
    },
    {
      "stage": "comunicacao",
      "section_key": "fina_iniciativas_original_2026",
      "title": "Iniciativas do arquivo · estados originais",
      "order_index": 2,
      "fields": [
        {
          "key": "iniciativa_1",
          "label": "Cursos caros com tráfego para leads",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_2",
          "label": "Copa com MaxBio",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_3",
          "label": "Material de apresentação institucional da loja",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_4",
          "label": "Grupo de Curso Comunidade de Curadoria",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_5",
          "label": "Cartão de aniversário / Experiência na loja",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: 2º semestre 2026"
        },
        {
          "key": "iniciativa_6",
          "label": "Fracionamento de produtos",
          "type": "textarea",
          "value": "Estado no arquivo: Concluído\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_7",
          "label": "Lives de Novidades na loja",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_8",
          "label": "Catálogo Digital - Loja Online",
          "type": "textarea",
          "value": "Estado no arquivo: Preparação\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_9",
          "label": "Workshops Gratuitos",
          "type": "textarea",
          "value": "Estado no arquivo: Preparação\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_10",
          "label": "Lançamentos Perfumaria Nova",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: 1º semestre 2026\nObservação: Lançamento de produto/kit"
        },
        {
          "key": "iniciativa_11",
          "label": "Exposição de produtos na loja",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_12",
          "label": "Moeda Fragrância",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir\nObservação: Sistema de fidelização/troca"
        },
        {
          "key": "iniciativa_13",
          "label": "Kit essências para troca com caixa personalizada",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_14",
          "label": "Treinamento da Equipe",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_15",
          "label": "Cursos por área de produtos vendidos na loja",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir\nObservação: Workshops gratuitos, custo apenas dos kits usados"
        },
        {
          "key": "iniciativa_16",
          "label": "Bônus para trabalhadores da região",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_17",
          "label": "Presskit para lojistas (bodysplash)",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_18",
          "label": "Embalagem para kits ao longo do ano",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir"
        },
        {
          "key": "iniciativa_19",
          "label": "Essência da Loja",
          "type": "textarea",
          "value": "Estado no arquivo: Planejamento\nPrioridade: Sem prioridade\nSemestre: A definir\nObservação: Produto de marca própria"
        }
      ]
    },
    {
      "stage": "conhecimento",
      "section_key": "fina_resultados_qualitativos_2026",
      "title": "Resultados qualitativos do arquivo",
      "order_index": 5,
      "fields": [
        {
          "key": "campanha_12_anos",
          "label": "Campanha 12 anos · Abr/26",
          "type": "textarea",
          "value": "Aumento de fluxo na loja física e alta procura pelos kits de aniversário."
        },
        {
          "key": "kits_dia_das_maes",
          "label": "Kits para vender no Dia das Mães · Mai/26",
          "type": "textarea",
          "value": "Kits prontos convertem melhor que itens avulsos entre as empreendedoras."
        },
        {
          "key": "conteudo_educativo",
          "label": "Conteúdo educativo",
          "type": "textarea",
          "value": "Ideia para Criar e Produtos que Vendem Muito lideram o engajamento no Instagram."
        },
        {
          "key": "casa_aconchegante",
          "label": "Casa Aconchegante · Jun/26",
          "type": "textarea",
          "value": "Crescimento de aromatizadores e velas; base de WhatsApp mais engajada."
        }
      ]
    }
  ],
  "initiatives": [
    {
      "title": "Cursos caros com tráfego para leads",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 0
    },
    {
      "title": "Copa com MaxBio",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 1
    },
    {
      "title": "Material de apresentação institucional da loja",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 2
    },
    {
      "title": "Grupo de Curso Comunidade de Curadoria",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 3
    },
    {
      "title": "Cartão de aniversário / Experiência na loja",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "2º semestre 2026",
      "description": null,
      "order_index": 4
    },
    {
      "title": "Fracionamento de produtos",
      "status": "concluida",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 5
    },
    {
      "title": "Lives de Novidades na loja",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 6
    },
    {
      "title": "Catálogo Digital - Loja Online",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 7
    },
    {
      "title": "Workshops Gratuitos",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 8
    },
    {
      "title": "Lançamentos Perfumaria Nova",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "1º semestre 2026",
      "description": "Lançamento de produto/kit",
      "order_index": 9
    },
    {
      "title": "Exposição de produtos na loja",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 10
    },
    {
      "title": "Moeda Fragrância",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": "Sistema de fidelização/troca",
      "order_index": 11
    },
    {
      "title": "Kit essências para troca com caixa personalizada",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 12
    },
    {
      "title": "Treinamento da Equipe",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 13
    },
    {
      "title": "Cursos por área de produtos vendidos na loja",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": "Workshops gratuitos, custo apenas dos kits usados",
      "order_index": 14
    },
    {
      "title": "Bônus para trabalhadores da região",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 15
    },
    {
      "title": "Presskit para lojistas (bodysplash)",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 16
    },
    {
      "title": "Embalagem para kits ao longo do ano",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": null,
      "order_index": 17
    },
    {
      "title": "Essência da Loja",
      "status": "em_andamento",
      "priority": "sem_prioridade",
      "semester": "A definir",
      "description": "Produto de marca própria",
      "order_index": 18
    }
  ],
  "campaigns": [
    {
      "title": "12 anos criando, perfumando e cuidando",
      "start_date": "2026-04-01",
      "end_date": "2026-04-10",
      "description": "Autoridade e história da marca",
      "message": "Kits de aniversário",
      "quarter": "Q2 2026"
    },
    {
      "title": "Prepare seus produtos para vender no Dia das Mães",
      "start_date": "2026-04-08",
      "end_date": "2026-05-01",
      "description": "Empreendedorismo artesanal",
      "message": "Kits para produzir e vender",
      "quarter": "Q2 2026"
    },
    {
      "title": "Aromas que viram presente",
      "start_date": "2026-05-01",
      "end_date": "2026-05-11",
      "description": "Conversão no Dia das Mães",
      "message": "Kits presenteáveis",
      "quarter": "Q2 2026"
    },
    {
      "title": "Crie experiências para o Dia dos Namorados",
      "start_date": "2026-05-13",
      "end_date": "2026-06-01",
      "description": "Antecipar produção dos clientes",
      "message": "Kits românticos",
      "quarter": "Q2 2026"
    },
    {
      "title": "Experiências que começam com um aroma",
      "start_date": "2026-06-01",
      "end_date": "2026-06-12",
      "description": "Dia dos Namorados",
      "message": "Kits e curadoria de fragrâncias",
      "quarter": "Q2 2026"
    },
    {
      "title": "Casa Aconchegante",
      "start_date": "2026-06-15",
      "end_date": "2026-07-01",
      "description": "Território de inverno",
      "message": "Aromatizadores e velas para o lar",
      "quarter": "Q2 2026"
    }
  ],
  "channels": [
    {
      "name": "Instagram",
      "status": "ativo",
      "description": "Canal principal de narrativa e conteúdo educativo",
      "order_index": 0
    },
    {
      "name": "WhatsApp",
      "status": "ativo",
      "description": "Atendimento, pedidos e relacionamento",
      "order_index": 1
    },
    {
      "name": "Loja física",
      "status": "ativo",
      "description": "Betim/MG — experiência, curadoria e atendimento especialista",
      "order_index": 2
    }
  ],
  "monthly": [
    {
      "month_ref": "2026-01",
      "decisoes_tomadas": "Sem registro ainda",
      "insights": "Sem registro ainda",
      "ponto_atencao": "Sem registro ainda",
      "resultados_internos": "Sem registro ainda"
    },
    {
      "month_ref": "2026-02",
      "decisoes_tomadas": "Sem registro ainda",
      "insights": "Sem registro ainda",
      "ponto_atencao": "Sem registro ainda",
      "resultados_internos": "Sem registro ainda"
    },
    {
      "month_ref": "2026-03",
      "decisoes_tomadas": "Sem registro ainda",
      "insights": "Sem registro ainda",
      "ponto_atencao": "Sem registro ainda",
      "resultados_internos": "Sem registro ainda"
    },
    {
      "month_ref": "2026-04",
      "decisoes_tomadas": "Lançar a campanha de 12 anos e antecipar os kits do Dia das Mães.",
      "insights": "O cliente valoriza a narrativa de autoridade e a história da marca.",
      "ponto_atencao": "Dependência do atendimento manual via WhatsApp nos picos.",
      "resultados_internos": "Aumento de fluxo na loja física e alta procura pelos kits de aniversário."
    },
    {
      "month_ref": "2026-05",
      "decisoes_tomadas": "Priorizar kits presenteáveis e iniciar a comunicação de Dia dos Namorados em 13/05.",
      "insights": "Kits prontos convertem melhor que itens avulsos para quem compra para presentear.",
      "ponto_atencao": "Falta de produtos de entrada padronizados limita o ticket inicial.",
      "resultados_internos": "Melhor desempenho de conteúdo nos quadros “Ideia para Criar” e “Produtos que Vendem Muito”."
    },
    {
      "month_ref": "2026-06",
      "decisoes_tomadas": "Emendar Dia dos Namorados com o território de inverno (“Casa Aconchegante”).",
      "insights": "Aroma associado a memória afetiva sustenta as duas campanhas na mesma narrativa.",
      "ponto_atencao": "Estoque de essências sazonais e prazo de embalagens personalizadas.",
      "resultados_internos": "Crescimento de aromatizadores e velas; base de WhatsApp mais engajada."
    },
    {
      "month_ref": "2026-07",
      "decisoes_tomadas": "Sem registro ainda",
      "insights": "Sem registro ainda",
      "ponto_atencao": "Sem registro ainda",
      "resultados_internos": "Sem registro ainda"
    },
    {
      "month_ref": "2026-08",
      "decisoes_tomadas": "Sem registro ainda",
      "insights": "Sem registro ainda",
      "ponto_atencao": "Sem registro ainda",
      "resultados_internos": "Sem registro ainda"
    },
    {
      "month_ref": "2026-09",
      "decisoes_tomadas": "Sem registro ainda",
      "insights": "Sem registro ainda",
      "ponto_atencao": "Sem registro ainda",
      "resultados_internos": "Sem registro ainda"
    },
    {
      "month_ref": "2026-10",
      "decisoes_tomadas": "Sem registro ainda",
      "insights": "Sem registro ainda",
      "ponto_atencao": "Sem registro ainda",
      "resultados_internos": "Sem registro ainda"
    },
    {
      "month_ref": "2026-11",
      "decisoes_tomadas": "Sem registro ainda",
      "insights": "Sem registro ainda",
      "ponto_atencao": "Sem registro ainda",
      "resultados_internos": "Sem registro ainda"
    },
    {
      "month_ref": "2026-12",
      "decisoes_tomadas": "Sem registro ainda",
      "insights": "Sem registro ainda",
      "ponto_atencao": "Sem registro ainda",
      "resultados_internos": "Sem registro ainda"
    }
  ],
  "meetings": [
    {
      "title": "Kickoff Campanha 12 Anos",
      "meeting_date": "2026-03-24",
      "participants": [
        "Reach",
        "Direção Fina Fragrância"
      ],
      "notes": "Decisões: Aprovar o conceito “12 anos criando, perfumando e cuidando” e os kits de aniversário. Responsáveis: Reach (criação) · Loja (produção dos kits)",
      "tasks": [
        {
          "description": "Fechar composição dos kits de aniversário",
          "due_date": "2026-03-31",
          "assignee": "Loja",
          "status": "concluida"
        },
        {
          "description": "Produzir peças da campanha de 12 anos",
          "due_date": "2026-04-01",
          "assignee": "Reach",
          "status": "concluida"
        }
      ]
    },
    {
      "title": "Alinhamento Dia das Mães",
      "meeting_date": "2026-04-06",
      "participants": [
        "Reach",
        "Equipe de loja"
      ],
      "notes": "Decisões: Antecipar a comunicação para empreendedoras a partir de 08/04 com kits para produzir e vender. Responsáveis: Loja (estoque) · Reach (conteúdo)",
      "tasks": [
        {
          "description": "Definir mix dos kits para vender no Dia das Mães",
          "due_date": "2026-04-10",
          "assignee": "Loja",
          "status": "concluida"
        },
        {
          "description": "Roteirizar conteúdos “Aromas que viram presente”",
          "due_date": "2026-04-28",
          "assignee": "Reach",
          "status": "em_andamento"
        }
      ]
    },
    {
      "title": "Planejamento Junho / Inverno",
      "meeting_date": "2026-05-18",
      "participants": [
        "Reach",
        "Direção Fina Fragrância"
      ],
      "notes": "Decisões: Emendar Dia dos Namorados com o território “Casa Aconchegante”. Responsáveis: Reach (calendário) · Loja (curadoria)",
      "tasks": [
        {
          "description": "Orçar embalagens personalizadas para junho",
          "due_date": "2026-05-22",
          "assignee": "Loja",
          "status": "em_andamento"
        },
        {
          "description": "Montar curadoria de aromas de inverno",
          "due_date": "2026-06-05",
          "assignee": "Reach + Loja",
          "status": "a_fazer"
        }
      ]
    }
  ]
}
$fina_archive$::jsonb;
  v_item jsonb;
  v_task jsonb;
  v_section_id uuid;
  v_meeting_id uuid;
  v_existing_fields jsonb;
  v_missing_fields jsonb;
  v_sections_added integer := 0;
  v_fields_added integer := 0;
  v_initiatives_added integer := 0;
  v_campaigns_added integer := 0;
  v_channels_added integer := 0;
  v_monthly_added integer := 0;
  v_meetings_added integer := 0;
  v_meeting_tasks_added integer := 0;
BEGIN
  -- Serializa chamadas simultâneas da restauração para o mesmo cliente.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_brand_id::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE id = p_brand_id
      AND (slug = 'fina-fragrancia' OR lower(name) IN ('fina fragrância', 'fina fragrancia'))
  ) THEN
    RAISE EXCEPTION 'Fina Fragrância não encontrada para este id';
  END IF;

  -- Atualiza somente campos cadastrais vazios. Mídia e cores não constam do ZIP.
  UPDATE public.brands
  SET segment = COALESCE(segment, 'Perfumaria artesanal & cosmética · Betim/MG'),
      description = COALESCE(description, 'Uma loja para criar, sentir e cuidar.')
  WHERE id = p_brand_id AND (segment IS NULL OR description IS NULL);

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_archive->'sections') LOOP
    SELECT id, fields INTO v_section_id, v_existing_fields
    FROM public.brand_home_sections
    WHERE brand_id = p_brand_id AND section_key = v_item->>'section_key'
    ORDER BY created_at LIMIT 1;

    IF v_section_id IS NULL THEN
      INSERT INTO public.brand_home_sections (brand_id, stage, section_key, title, order_index, fields)
      VALUES (p_brand_id, v_item->>'stage', v_item->>'section_key', v_item->>'title',
              (v_item->>'order_index')::integer, v_item->'fields');
      v_sections_added := v_sections_added + 1;
      v_fields_added := v_fields_added + jsonb_array_length(v_item->'fields');
    ELSIF v_existing_fields IS NULL OR jsonb_typeof(v_existing_fields) = 'array' THEN
      SELECT COALESCE(jsonb_agg(source.value ORDER BY source.ordinality), '[]'::jsonb)
      INTO v_missing_fields
      FROM jsonb_array_elements(v_item->'fields') WITH ORDINALITY AS source(value, ordinality)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(v_existing_fields, '[]'::jsonb)) AS existing(value)
        WHERE existing.value->>'key' = source.value->>'key'
      );

      IF jsonb_array_length(v_missing_fields) > 0 THEN
        UPDATE public.brand_home_sections
        SET fields = COALESCE(fields, '[]'::jsonb) || v_missing_fields
        WHERE id = v_section_id;
        v_fields_added := v_fields_added + jsonb_array_length(v_missing_fields);
      END IF;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_archive->'initiatives') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.espaco360_initiatives WHERE brand_id = p_brand_id AND title = v_item->>'title') THEN
      INSERT INTO public.espaco360_initiatives (brand_id, title, status, priority, semester, description, order_index)
      VALUES (p_brand_id, v_item->>'title', v_item->>'status', v_item->>'priority', v_item->>'semester',
              v_item->>'description', (v_item->>'order_index')::integer);
      v_initiatives_added := v_initiatives_added + 1;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_archive->'campaigns') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.espaco360_campaigns WHERE brand_id = p_brand_id AND title = v_item->>'title') THEN
      INSERT INTO public.espaco360_campaigns
        (brand_id, title, start_date, end_date, status, stage, priority, quarter, description, message)
      VALUES
        (p_brand_id, v_item->>'title', (v_item->>'start_date')::date, (v_item->>'end_date')::date,
         'planejada', 'planejamento', 'sem_prioridade', v_item->>'quarter', v_item->>'description', v_item->>'message');
      v_campaigns_added := v_campaigns_added + 1;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_archive->'channels') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.espaco360_channels WHERE brand_id = p_brand_id AND name = v_item->>'name') THEN
      INSERT INTO public.espaco360_channels (brand_id, name, status, description, order_index)
      VALUES (p_brand_id, v_item->>'name', v_item->>'status', v_item->>'description', (v_item->>'order_index')::integer);
      v_channels_added := v_channels_added + 1;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_archive->'monthly') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.espaco360_monthly_tracking WHERE brand_id = p_brand_id AND month_ref = v_item->>'month_ref') THEN
      INSERT INTO public.espaco360_monthly_tracking
        (brand_id, month_ref, decisoes_tomadas, insights, ponto_atencao, resultados_internos)
      VALUES (p_brand_id, v_item->>'month_ref', v_item->>'decisoes_tomadas', v_item->>'insights',
              v_item->>'ponto_atencao', v_item->>'resultados_internos');
      v_monthly_added := v_monthly_added + 1;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_archive->'meetings') LOOP
    SELECT id INTO v_meeting_id FROM public.espaco360_meetings
    WHERE brand_id = p_brand_id AND title = v_item->>'title'
    ORDER BY created_at LIMIT 1;
    IF v_meeting_id IS NULL THEN
      INSERT INTO public.espaco360_meetings (brand_id, title, meeting_date, participants, notes)
      VALUES (p_brand_id, v_item->>'title', (v_item->>'meeting_date')::date,
              v_item->'participants', v_item->>'notes') RETURNING id INTO v_meeting_id;
      v_meetings_added := v_meetings_added + 1;
    END IF;
    FOR v_task IN SELECT value FROM jsonb_array_elements(v_item->'tasks') LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.espaco360_meeting_tasks
        WHERE meeting_id = v_meeting_id AND description = v_task->>'description'
      ) THEN
        INSERT INTO public.espaco360_meeting_tasks
          (meeting_id, brand_id, description, due_date, assignee, status)
        VALUES (v_meeting_id, p_brand_id, v_task->>'description', (v_task->>'due_date')::date,
                v_task->>'assignee', v_task->>'status');
        v_meeting_tasks_added := v_meeting_tasks_added + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'sections_added', v_sections_added, 'fields_added', v_fields_added,
    'initiatives_added', v_initiatives_added, 'campaigns_added', v_campaigns_added,
    'channels_added', v_channels_added, 'monthly_added', v_monthly_added,
    'meetings_added', v_meetings_added, 'meeting_tasks_added', v_meeting_tasks_added
  );
END;
$fina_restore$;

REVOKE ALL ON FUNCTION public.restore_fina_fragrancia_archive(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_fina_fragrancia_archive(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.restore_fina_fragrancia_archive(uuid) TO service_role;

-- Completa clientes já existentes; a mesma RPC pode ser chamada após o botão
-- criar a Fina em uma instalação nova.
DO $fina_existing$
DECLARE v_brand_id uuid;
BEGIN
  FOR v_brand_id IN
    SELECT id FROM public.brands
    WHERE slug = 'fina-fragrancia' OR lower(name) IN ('fina fragrância', 'fina fragrancia')
  LOOP
    PERFORM public.restore_fina_fragrancia_archive(v_brand_id);
  END LOOP;
END;
$fina_existing$;
