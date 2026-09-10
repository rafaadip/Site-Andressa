/**
 * Fonte única do perfil profissional.
 *
 * ⚠️ NENHUM outro arquivo deve escrever título, CRM ou endereço à mão.
 * `scripts/check-conformidade.ts` quebra o build se isso acontecer.
 *
 * Ver docs/fases/FASE-10-compliance-lgpd-cfm.md
 */

export type Endereco = {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cep: string;
  mapsUrl: string;
};

export const PROFISSIONAL = {
  nome: 'Dra. Andressa Chaves Correia',
  nomeCurto: 'Dra. Andressa Correia',
  crm: 'CRM-SP 267.777',

  /**
   * ⚠️ Registro de Qualificação de Especialista.
   * A pós-graduação em Nutrologia (Afya) está EM CURSO até jul/2027.
   * Enquanto `rqe` for null, o site NÃO pode anunciar especialidade —
   * é infração ética passível de processo no CRM.
   * Preencher aqui quando o CRM emitir; `tituloPublico()` se ajusta sozinho.
   */
  rqe: null as string | null,
  tituloSemRqe: 'Médica · com atuação em Nutrologia',
  formacaoEmCurso: 'Pós-graduanda em Nutrologia (Afya)',

  cidade: 'Guarulhos',
  uf: 'SP',
  telefone: '+5511998053826',
  telefoneExibicao: '(11) 9 9805-3826',
  email: 'andressa15correia@gmail.com',
  timezone: 'America/Sao_Paulo',

  /**
   * ⚠️ Endereço do consultório ainda NÃO definido (10/09/2026).
   * Com `null`, o site opera em "modo sem endereço": site, .ics e JSON-LD
   * degradam para "endereço enviado na confirmação".
   * Preencher este objeto ativa os três de uma vez.
   * Ver docs/fases/FASE-03-site-institucional.md §3.1
   */
  endereco: null as Endereco | null,
} as const;

/** Título público. Muda sozinho quando o RQE for registrado. */
export function tituloPublico(): string {
  return PROFISSIONAL.rqe
    ? `Médica · Especialista em Nutrologia · RQE ${PROFISSIONAL.rqe}`
    : PROFISSIONAL.tituloSemRqe;
}

/** Identificação exigida pelo CFM em toda página pública. */
export function identificacaoCfm(): string {
  return `${PROFISSIONAL.nome} · ${PROFISSIONAL.crm}`;
}

export type Modalidade = 'in_person' | 'telehealth';

/**
 * Texto do local da consulta. Usado no site, no .ics e nos e-mails.
 * Único lugar que sabe se o endereço existe.
 */
export function localConsulta(modalidade: Modalidade): string {
  if (modalidade === 'telehealth') {
    return 'Teleconsulta (link enviado antes da consulta)';
  }
  const e = PROFISSIONAL.endereco;
  if (!e) {
    return `Consultório em ${PROFISSIONAL.cidade}/${PROFISSIONAL.uf}`
      + ' — endereço enviado na confirmação';
  }
  const compl = e.complemento ? `, ${e.complemento}` : '';
  return `${e.logradouro}, ${e.numero}${compl} — ${e.bairro},`
    + ` ${PROFISSIONAL.cidade}/${PROFISSIONAL.uf}`;
}

/** `true` quando há endereço publicável (destrava mapa e JSON-LD completo). */
export function temEnderecoPublico(): boolean {
  return PROFISSIONAL.endereco !== null;
}
