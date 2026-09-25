/**
 * Conteúdo dos e-mails — FASE-08 §1 e §2.
 *
 * Tom sóbrio, sem promessa de resultado (passa pelo check:conformidade).
 * Só se promete o que o sistema faz: o link de cancelar só aparece quando
 * o prazo ainda permite cancelar por ele.
 *
 * Teto: no máximo 3 e-mails ao paciente no caminho feliz — confirmação,
 * lembrete D-1 e lembrete H-2.
 */
import type { Modalidade } from '../config';
import type { Bloco, Documento } from './layout';

/** "segunda-feira, 15 de setembro às 14:00" → "Segunda-feira, 15…" */
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type CtxConsulta = {
  nome: string;
  quando: string;
  quandoCurto: string;
  tipo: string;
  modalidade: Modalidade;
  local: string;
  duracaoMin: number;
  urlGestao: string;
  urlGoogle: string;
  urlAgendar: string;
  urlWhatsApp: string;
  telehealthUrl: string | null;
  mapsUrl: string | null;
  podeCancelarPeloLink: boolean;
  prazoCancelamentoHoras: number;
};

export type CtxMedica = {
  nome: string;
  telefone: string;
  email: string;
  quando: string;
  tipo: string;
  local: string;
  comMotivo: boolean;
  urlPainel: string;
};

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? '';
}

function cartao(c: CtxConsulta): Bloco {
  return {
    t: 'dados',
    linhas: [
      ['Consulta', c.tipo],
      ['Quando', maiuscula(c.quando)],
      ['Local', c.local],
      ['Duração', `${c.duracaoMin} minutos`],
    ],
  };
}

function orientacoes(c: CtxConsulta): Bloco[] {
  if (c.modalidade === 'telehealth') {
    return c.telehealthUrl
      ? [
          { t: 'botao', href: c.telehealthUrl, rotulo: 'Entrar na teleconsulta' },
          { t: 'nota', texto: 'Use um lugar reservado, com boa conexão. Tenha exames recentes em mãos, se tiver.' },
        ]
      : [{ t: 'nota', texto: 'O link da teleconsulta será enviado antes do horário. Use um lugar reservado, com boa conexão, e tenha exames recentes em mãos, se tiver.' }];
  }
  return [
    ...(c.mapsUrl ? [{ t: 'botao', href: c.mapsUrl, rotulo: 'Ver no mapa', secundario: true } as Bloco] : []),
    { t: 'nota', texto: 'Chegue com 10 minutos de antecedência. Traga exames recentes, se tiver.' },
  ];
}

function comoDesmarcar(c: CtxConsulta): Bloco[] {
  return c.podeCancelarPeloLink
    ? [
        { t: 'botao', href: c.urlGestao, rotulo: 'Remarcar ou cancelar', secundario: true },
        { t: 'nota', texto: `Pelo link, até ${c.prazoCancelamentoHoras} horas antes. Depois disso, fale pelo WhatsApp.` },
      ]
    : [
        { t: 'botao', href: c.urlWhatsApp, rotulo: 'Avisar pelo WhatsApp', secundario: true },
        { t: 'nota', texto: 'Se não puder comparecer, avise pelo WhatsApp: o horário é reaproveitado.' },
      ];
}

// ── Paciente ─────────────────────────────────────────────────────────────

export function confirmacao(c: CtxConsulta): Documento {
  return {
    assunto: `Consulta confirmada — ${c.quando}`,
    preheader: `${c.tipo} · ${maiuscula(c.quando)}. O convite para o calendário está em anexo.`,
    blocos: [
      { t: 'titulo', texto: `Olá, ${primeiroNome(c.nome)}.` },
      { t: 'p', texto: 'Sua consulta está confirmada.' },
      cartao(c),
      { t: 'p', texto: 'O arquivo em anexo adiciona a consulta ao calendário do iPhone, Android ou Outlook. No Google Agenda, use o botão:' },
      { t: 'botao', href: c.urlGoogle, rotulo: 'Adicionar ao Google Agenda' },
      ...orientacoes(c),
      ...comoDesmarcar(c),
    ],
  };
}

export function cancelamento(c: CtxConsulta & { motivo: string | null; pelaMedica: boolean }): Documento {
  const blocos: Bloco[] = [
    { t: 'titulo', texto: `Olá, ${primeiroNome(c.nome)}.` },
    {
      t: 'p',
      texto: c.pelaMedica
        ? `Sua consulta de ${c.quando} precisou ser cancelada. Pedimos desculpas pelo transtorno.`
        : `Sua consulta de ${c.quando} foi cancelada, como você pediu.`,
    },
  ];
  if (c.motivo) blocos.push({ t: 'dados', linhas: [['Recado da médica', c.motivo]] });
  blocos.push(
    { t: 'p', texto: 'Abrir o arquivo em anexo remove o evento do calendário do iPhone e do Outlook.' },
    { t: 'botao', href: c.urlAgendar, rotulo: 'Agendar outro horário' },
    { t: 'botao', href: c.urlWhatsApp, rotulo: 'Falar pelo WhatsApp', secundario: true },
  );
  return {
    assunto: `Consulta cancelada — ${c.quandoCurto}`,
    preheader: c.pelaMedica ? 'Sua consulta precisou ser cancelada.' : 'Cancelamento confirmado.',
    blocos,
  };
}

export function remarcacao(c: CtxConsulta & { quandoAnterior: string }): Documento {
  return {
    assunto: `Consulta remarcada — ${c.quando}`,
    preheader: `Novo horário: ${maiuscula(c.quando)}.`,
    blocos: [
      { t: 'titulo', texto: `Olá, ${primeiroNome(c.nome)}.` },
      { t: 'p', texto: `Sua consulta, antes marcada para ${c.quandoAnterior}, mudou de horário.` },
      cartao(c),
      { t: 'p', texto: 'Abrir o arquivo em anexo atualiza o evento no seu calendário. No Google Agenda:' },
      { t: 'botao', href: c.urlGoogle, rotulo: 'Adicionar ao Google Agenda' },
      ...comoDesmarcar(c),
    ],
  };
}

export function lembreteD1(c: CtxConsulta): Documento {
  return {
    assunto: `Lembrete: sua consulta é amanhã, ${c.quandoCurto}`,
    preheader: `${c.tipo} · ${maiuscula(c.quando)}.`,
    blocos: [
      { t: 'titulo', texto: `Até amanhã, ${primeiroNome(c.nome)}.` },
      cartao(c),
      ...orientacoes(c),
      ...comoDesmarcar(c),
    ],
  };
}

export function lembreteH2(c: CtxConsulta): Documento {
  return {
    assunto: `Sua consulta é daqui a pouco — ${c.quandoCurto}`,
    preheader: `${c.tipo} · ${c.local}.`,
    blocos: [
      { t: 'titulo', texto: `Olá, ${primeiroNome(c.nome)}.` },
      { t: 'p', texto: `Sua consulta começa ${c.quando.replace(/^.*? às /, 'às ')}.` },
      cartao(c),
      ...orientacoes(c),
      { t: 'botao', href: c.urlWhatsApp, rotulo: 'Avisar pelo WhatsApp', secundario: true },
    ],
  };
}

// ── Médica ───────────────────────────────────────────────────────────────

function dadosMedica(c: CtxMedica): Bloco {
  return {
    t: 'dados',
    linhas: [
      ['Quando', maiuscula(c.quando)],
      ['Paciente', c.nome],
      ['Telefone', c.telefone],
      ['E-mail', c.email],
      ['Consulta', `${c.tipo} · ${c.local}`],
    ],
  };
}

export function novaConsulta(c: CtxMedica): Documento {
  return {
    assunto: `Nova consulta: ${c.nome} — ${c.quando}`,
    preheader: `${c.tipo}. Agendada pelo site.`,
    blocos: [
      { t: 'titulo', texto: 'Nova consulta agendada' },
      dadosMedica(c),
      // O motivo é dado de saúde: fica no painel (atrás de login), não no e-mail.
      ...(c.comMotivo ? [{ t: 'nota', texto: 'O paciente informou o motivo da consulta — veja no painel.' } as Bloco] : []),
      { t: 'botao', href: c.urlPainel, rotulo: 'Abrir o painel' },
    ],
  };
}

export function cancelamentoParaMedica(c: CtxMedica): Documento {
  return {
    assunto: `Consulta cancelada pelo paciente: ${c.nome} — ${c.quando}`,
    preheader: 'O horário voltou a ficar livre no site.',
    blocos: [
      { t: 'titulo', texto: 'Consulta cancelada pelo paciente' },
      dadosMedica(c),
      { t: 'nota', texto: 'O horário voltou a ser oferecido no site, e o evento sai da sua agenda do Google.' },
      { t: 'botao', href: c.urlPainel, rotulo: 'Abrir o painel' },
    ],
  };
}

export type CtxAlerta = { urlPainel: string; detalhe?: string };

export function alertaAgendaDesconectada(c: CtxAlerta): Documento {
  return {
    assunto: 'Ação necessária: sua agenda do Google foi desconectada',
    preheader: 'O site não consegue ver seus compromissos até você reconectar.',
    blocos: [
      { t: 'titulo', texto: 'Sua agenda do Google foi desconectada' },
      { t: 'p', texto: 'O site perdeu o acesso à sua agenda. Até você reconectar, ele NÃO enxerga seus plantões: por segurança, só oferece horários a partir de depois de amanhã, e as novas consultas não aparecem na sua agenda.' },
      { t: 'botao', href: c.urlPainel, rotulo: 'Reconectar agora' },
      { t: 'nota', texto: 'Isso acontece quando a senha do Google muda ou o acesso é removido nas configurações da conta.' },
    ],
  };
}

export function alertaSincronizacao(c: CtxAlerta & { quando: string; nome: string }): Documento {
  return {
    assunto: `Consulta não chegou à sua agenda: ${c.nome} — ${c.quando}`,
    preheader: 'A consulta está marcada, mas o evento não foi criado no Google.',
    blocos: [
      { t: 'titulo', texto: 'Uma consulta não chegou à sua agenda' },
      { t: 'p', texto: `A consulta de ${c.nome} (${c.quando}) está marcada no site, mas o evento não pôde ser gravado na sua agenda do Google depois de várias tentativas.` },
      ...(c.detalhe ? [{ t: 'nota', texto: `Detalhe técnico: ${c.detalhe}` } as Bloco] : []),
      { t: 'botao', href: c.urlPainel, rotulo: 'Ver no painel' },
    ],
  };
}

export function alertaConflito(c: CtxAlerta & { quando: string; nome: string }): Documento {
  return {
    assunto: `Não foi possível mover a consulta de ${c.nome}`,
    preheader: 'O novo horário sobrepõe outra consulta.',
    blocos: [
      { t: 'titulo', texto: 'Consulta não foi movida' },
      { t: 'p', texto: `Você moveu na agenda do Google a consulta de ${c.nome} (${c.quando}), mas o novo horário sobrepõe outra consulta marcada. O site manteve o horário original e o paciente NÃO foi avisado.` },
      { t: 'p', texto: 'Ajuste pelo painel ou devolva o evento ao horário original na sua agenda.' },
      { t: 'botao', href: c.urlPainel, rotulo: 'Abrir o painel' },
    ],
  };
}

export function alertaBounce(c: CtxAlerta & { quando: string; nome: string; telefone: string }): Documento {
  return {
    assunto: `E-mail do paciente não foi entregue: ${c.nome}`,
    preheader: 'Confirme a consulta pelo WhatsApp.',
    blocos: [
      { t: 'titulo', texto: 'E-mail não entregue' },
      { t: 'p', texto: `O e-mail de ${c.nome} voltou (endereço inexistente ou recusado). A consulta de ${c.quando} continua marcada, mas o paciente pode não ter recebido a confirmação.` },
      { t: 'dados', linhas: [['Telefone', c.telefone]] },
      { t: 'botao', href: c.urlPainel, rotulo: 'Abrir o painel' },
    ],
  };
}
