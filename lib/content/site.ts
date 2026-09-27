/**
 * Conteúdo institucional — fonte única de copy.
 *
 * Fica fora do JSX de propósito: a médica vai querer ajustar redação, e um
 * arquivo de conteúdo é revisável num PR sem tocar em layout. Também passa
 * pelo `scripts/check-conformidade.ts`, que barra superlativo, promessa de
 * resultado, preço e "especialista" (docs/fases/FASE-10).
 *
 * Nome, título, CRM e local NÃO aparecem aqui como texto: vêm de
 * `lib/config.ts`.
 */

export const NAVEGACAO = [
  { href: '/#sobre', rotulo: 'Sobre' },
  { href: '/#atendimento', rotulo: 'Atendimento' },
  { href: '/#nutrologia', rotulo: 'Nutrologia' },
  { href: '/#contato', rotulo: 'Contato' },
] as const;

export const HERO = {
  titulo: 'Nutrologia é olhar para o paciente',
  tituloDestaque: 'como um todo.',
  lead:
    'Consultas presenciais e por teleconsulta. Um plano construído a partir da '
    + 'sua história, da sua rotina e dos seus objetivos — realista para caber '
    + 'na sua vida.',
  ctaPrimario: 'Agendar consulta',
  ctaSecundario: 'Conhecer a doutora',
} as const;

/** Faixa de credenciais. Fatos do currículo, sem adjetivo. */
export const CREDENCIAIS = [
  { titulo: 'Medicina — UNINOVE', detalhe: 'Graduação, 2019–2024' },
  { titulo: 'Pós-graduação em Nutrologia', detalhe: 'Afya · em curso' },
  { titulo: 'ACLS', detalhe: 'Suporte avançado de vida cardiovascular' },
] as const;

export const SOBRE = {
  paragrafos: [
    'Médica formada pela Universidade Nove de Julho (UNINOVE), com atuação em '
      + 'urgência e emergência na rede hospitalar de Guarulhos e São Paulo.',
    'A formação em pronto atendimento — estabilização de pacientes, análise de '
      + 'eletrocardiograma, condutas de emergência — moldou uma leitura clínica '
      + 'atenta ao todo. Hoje ela a leva para o cuidado de longo prazo, em '
      + 'pós-graduação em Nutrologia pela Afya.',
  ],
  citacao:
    'Cada paciente chega com uma história. O meu trabalho começa em ouvi-la com atenção.',
} as const;

/** Trajetória resumida — a versão completa está em /sobre. */
export const TRAJETORIA = [
  { onde: 'Hapvida', papel: 'Médica', quando: 'desde dez/2025' },
  { onde: 'UPA Taboão — Guarulhos', papel: 'Médica', quando: 'desde jan/2025' },
  { onde: 'Complexo Hospitalar Padre Bento de Guarulhos', papel: 'Médica', quando: 'ago/2025 – fev/2026' },
  { onde: 'Hospital Keila Ferreira — Guarulhos', papel: 'Médica', quando: 'fev/2026' },
] as const;

/** Só na página /sobre. */
export const TRAJETORIA_COMPLEMENTAR = [
  { onde: 'Atuação autônoma — São Paulo, SP', papel: 'Médica', quando: 'desde jan/2025' },
] as const;

export const FORMACAO = [
  { onde: 'Afya', papel: 'Pós-graduação Lato Sensu em Nutrologia — em curso', quando: 'fev/2026 – jul/2027' },
  { onde: 'Universidade Nove de Julho (UNINOVE)', papel: 'Graduação em Medicina', quando: 'fev/2019 – dez/2024' },
  { onde: 'ACLS — Advanced Cardiovascular Life Support', papel: 'Certificação', quando: '' },
] as const;

export const TRAJETORIA_FORMACAO = [
  { onde: 'Santa Casa de Misericórdia de São Paulo', papel: 'Internato — urgência e emergência', quando: 'out/2024 – jan/2025' },
  { onde: 'Hospital Geral de Guarulhos', papel: 'Internato — urgência, emergência, ginecologia e obstetrícia', quando: 'jun/2024 – jan/2025' },
  { onde: 'Liga de Alergia e Imunologia — UNINOVE', papel: 'Diretoria', quando: '2021 – 2023' },
  { onde: 'Centro Acadêmico Rebeca Boltes Cecatto — UNINOVE', papel: 'Financeiro', quando: '2022 – 2023' },
] as const;

export const ATENDIMENTO = {
  titulo: 'Como é o atendimento',
  lead:
    'Consultas com tempo para avaliação, orientação e acompanhamento — no '
    + 'consultório ou por vídeo.',
  modalidades: [
    {
      titulo: 'Consulta em Nutrologia',
      texto:
        'Avaliação ampla: história clínica, hábitos, rotina, sono, composição '
        + 'corporal e exames. O resultado é um plano individualizado e possível '
        + 'de seguir.',
      etiqueta: 'Presencial',
      modalidade: 'in_person',
    },
    {
      titulo: 'Teleconsulta',
      texto:
        'Atendimento por vídeo, nos termos da regulamentação do CFM para '
        + 'telemedicina. Indicada para orientações, retornos e avaliação de '
        + 'resultados de exames.',
      etiqueta: 'Online',
      modalidade: 'telehealth',
    },
    {
      titulo: 'Acompanhamento',
      texto:
        'Reavaliação periódica e ajuste de conduta. O plano muda quando a sua '
        + 'vida muda — e o acompanhamento existe para isso.',
      etiqueta: 'Presencial ou online',
      modalidade: null,
    },
  ],
} as const;

/** Os quatro eixos do carrossel "Nutrologia não é simplesmente passar dieta". */
export const NUTROLOGIA = {
  titulo: 'Nutrologia não é simplesmente passar dieta',
  lead: 'É entender a sua rotina, a sua biologia e buscar uma saúde que se sustente.',
  eixos: [
    {
      icone: 'historia',
      titulo: 'História clínica',
      texto:
        'A base de um plano bem construído considera muito mais do que números: '
        + 'rotina, hábitos, sono, estresse e o seu contexto.',
    },
    {
      icone: 'composicao',
      titulo: 'Composição corporal',
      texto:
        'O número da balança não conta a história inteira. Massa muscular, '
        + 'gordura corporal e IMC, lidos em conjunto, ajudam a ir além.',
    },
    {
      icone: 'alimentacao',
      titulo: 'Alimentação',
      texto:
        'Nutrição vai muito além de regras e calorias. Equilíbrio é a palavra '
        + 'mais importante — e a estratégia precisa caber na sua rotina.',
    },
    {
      icone: 'alem',
      titulo: 'Além da alimentação',
      texto: 'Sono, atividade física, estresse e comportamento também fazem parte da sua saúde.',
    },
  ],
} as const;

export const COMO_AGENDAR = {
  titulo: 'Agende em poucos passos',
  lead: 'Sem cadastro e sem senha. Ao confirmar, a consulta vai direto para o calendário do seu celular.',
  passos: [
    { titulo: 'Escolha a modalidade', texto: 'Presencial ou teleconsulta.' },
    { titulo: 'Escolha data e horário', texto: 'Só aparecem horários realmente livres.' },
    { titulo: 'Confirme', texto: 'Você recebe o convite para o calendário do iPhone, Android ou Outlook.' },
  ],
} as const;

/**
 * Perguntas frequentes. O prazo de cancelamento vem do painel
 * (/admin/configuracoes) — escrito à mão aqui, o site prometeria um prazo
 * que o sistema não cumpre quando ela o mudasse.
 */
export const perguntasFrequentes = (prazoCancelamentoHoras: number) => [
  {
    pergunta: 'Como funciona a primeira consulta?',
    resposta:
      'É uma avaliação ampla, com tempo para ouvir a sua história: queixas, '
      + 'hábitos, rotina, sono, histórico de saúde e exames. A partir disso, '
      + 'é construído um plano individualizado.',
  },
  {
    pergunta: 'Preciso levar exames?',
    resposta:
      'Se você tiver exames recentes, leve-os à consulta ou tenha-os em mãos '
      + 'na teleconsulta. Quando necessário, novos exames são solicitados.',
  },
  {
    pergunta: 'A teleconsulta funciona como a presencial?',
    resposta:
      'Ela segue a regulamentação do CFM para telemedicina e atende bem a '
      + 'orientações, retornos e avaliação de exames. Algumas situações pedem '
      + 'exame físico — nesse caso, você será orientado(a) a fazer a consulta '
      + 'presencial.',
  },
  {
    pergunta: 'Como recebo o horário no meu celular?',
    resposta:
      'Ao confirmar, a própria tela mostra os botões para adicionar a consulta '
      + 'ao Google Agenda ou ao calendário do iPhone, Android e Outlook — sem '
      + 'depender de e-mail.',
  },
  {
    pergunta: 'Posso remarcar ou cancelar?',
    resposta:
      `Sim, até ${prazoCancelamentoHoras} horas antes, pelo link da sua consulta — ele aparece na tela `
      + 'de confirmação e fica salvo no evento do seu calendário. Depois desse '
      + 'prazo, fale pelo WhatsApp.',
  },
  {
    pergunta: 'Atende convênio?',
    resposta:
      'Para informações sobre forma de pagamento e reembolso, fale com o '
      + 'consultório pelo WhatsApp.',
  },
] as const;

export const URGENCIA = {
  titulo: 'Este site não atende urgências.',
  texto:
    'Em caso de dor no peito, falta de ar intensa, perda de consciência ou '
    + 'sinais de AVC, procure o pronto-socorro mais próximo ou ligue',
  telefone: '192 (SAMU)',
} as const;

/**
 * Textos de consentimento do formulário (LGPD Art. 8º e 11).
 * ⚠️ Mudou o texto? Suba VERSAO_CONSENTIMENTO em
 * lib/validation/agendamento.ts: cada consulta registra a versão aceita.
 */
export const CONSENTIMENTO = {
  dados: {
    texto: 'Autorizo o uso do meu nome, telefone e e-mail para agendar, confirmar e me lembrar desta consulta, conforme a',
    link: 'política de privacidade',
  },
  saude: {
    antes: 'O motivo que escrevi é',
    destaque: 'informação de saúde',
    depois: '. Autorizo o seu registro para esta consulta. Ele é apagado 90 dias depois.',
  },
} as const;

/**
 * Confirmação em 2 etapas para apagar o motivo da consulta (dado de saúde) —
 * mesmo padrão do cancelamento (achado UX-05: um só toque apagava direto).
 */
export const CONFIRMAR_APAGAR_MOTIVO = {
  botaoInicial: 'Apagar o motivo que escrevi',
  pergunta: 'Apagar o motivo que você escreveu?',
  aviso: 'É uma informação de saúde. Depois de apagado, não dá para recuperar.',
  botaoConfirmar: 'Sim, apagar',
  botaoManter: 'Manter o motivo',
} as const;

/**
 * Prazo em que o pedido de contato é apagado por inteiro. Fonte ÚNICA: o
 * texto de consentimento abaixo e a retenção automática
 * (lib/lgpd/retencao.ts) leem daqui — o texto nunca promete outro prazo.
 */
export const CONTATO_RETENCAO_DIAS = 90;

/**
 * Formulário de contato (seção Contato da home): grava o pedido para a
 * médica retornar pelo painel (POST /api/contatos, com consentimento) e
 * abre o WhatsApp com a mensagem já montada (lib/contato.ts →
 * mensagemContato). Motivo e horário são listas FECHADAS: o que chega ao
 * banco e ao WhatsApp é sempre um destes itens, nunca texto livre.
 * ⚠️ Mudou `consentimento`? Suba VERSAO_CONSENTIMENTO_CONTATO em
 * lib/validation/contato.ts.
 */
export const FORMULARIO_CONTATO = {
  titulo: 'Prefere que o consultório fale com você?',
  lead: 'Preencha e a conversa abre no WhatsApp já com os seus dados — é só enviar.',
  rotulos: {
    nome: 'Nome',
    sobrenome: 'Sobrenome',
    telefone: 'Telefone com DDD',
    email: 'E-mail',
    idade: 'Idade',
    horario: 'Preferência de horário para a consulta',
    motivo: 'Motivo da consulta',
  },
  selecione: 'Selecione um motivo',
  botao: 'Enviar pelo WhatsApp',
  enviado: 'Abrimos o WhatsApp com a sua mensagem. Se não abriu, toque de novo em "Enviar pelo WhatsApp".',
  registrado: 'Seu pedido também ficou registrado para o consultório retornar o contato.',
  consentimento: {
    texto:
      'Autorizo o consultório a guardar estes dados — inclusive o motivo da consulta, que é informação de saúde — '
      + `para retornar o meu contato. Eles são apagados em ${CONTATO_RETENCAO_DIAS} dias. Detalhes na`,
    link: 'política de privacidade',
  },
  /** Campo-isca: invisível para pessoas; robô que preenche tudo é ignorado. */
  isca: 'Não preencha este campo',
  horarios: [
    { id: 'manha', rotulo: 'Manhã' },
    { id: 'tarde', rotulo: 'Tarde' },
    { id: 'noite', rotulo: 'Noite' },
  ],
  motivos: [
    { id: 'emagrecimento', rotulo: 'Emagrecimento' },
    { id: 'ganho-de-massa', rotulo: 'Ganho de massa muscular' },
    { id: 'performance', rotulo: 'Performance esportiva' },
    { id: 'reeducacao', rotulo: 'Reeducação alimentar' },
    { id: 'vitaminas', rotulo: 'Vitaminas e minerais' },
    { id: 'metabolismo', rotulo: 'Glicemia, colesterol e triglicerídeos' },
    { id: 'intestino', rotulo: 'Saúde intestinal' },
    { id: 'vegetariana', rotulo: 'Alimentação vegetariana ou vegana' },
    { id: 'gestacao', rotulo: 'Gestação e amamentação' },
    { id: 'exames', rotulo: 'Avaliação de exames' },
    { id: 'outros', rotulo: 'Outros' },
  ],
  /** Rótulos das linhas da mensagem do WhatsApp. */
  mensagem: {
    abertura: 'Gostaria de agendar uma consulta.',
    nome: 'Nome',
    idade: 'Idade',
    email: 'E-mail',
    telefone: 'Telefone',
    horario: 'Preferência de horário',
    motivo: 'Motivo',
  },
} as const;
