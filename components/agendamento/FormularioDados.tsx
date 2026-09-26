import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { mascararTelefone } from '@/lib/telefone';
import { sugerirEmail } from '@/lib/validation/agendamento';
import { CONSENTIMENTO } from '@/lib/content/site';
import { rolarParaVista } from '@/lib/scroll-para-vista';
import { Campo, CampoTexto } from './Campo';

export type Dados = {
  nome: string;
  telefone: string;
  email: string;
  motivo: string;
  consentimentoDados: boolean;
  consentimentoSaude: boolean;
};

export const DADOS_VAZIOS: Dados = {
  nome: '', telefone: '', email: '', motivo: '', consentimentoDados: false, consentimentoSaude: false,
};

/** Ordem visual = ordem de foco quando há erro (foco vai no 1º inválido). */
export const ORDEM_CAMPOS = ['nome', 'telefone', 'email', 'motivo', 'consentimentoDados', 'consentimentoSaude'] as const;

type Props = {
  dados: Dados;
  erros: Record<string, string>;
  aoMudar: <K extends keyof Dados>(campo: K, valor: Dados[K]) => void;
  aoSair: (campo: keyof Dados) => void;
};

export function FormularioDados({ dados, erros, aoMudar, aoSair }: Props) {
  const sugestao = erros.email ? null : sugerirEmail(dados.email);
  const temMotivo = dados.motivo.trim().length > 0;

  // UX-06: a sugestão pode nascer atrás da BarraAcoes (sticky bottom) — só
  // rola quando ela APARECE (não a cada tecla, enquanto ela já está visível).
  const sugestaoRef = useRef<HTMLParagraphElement>(null);
  const sugestaoAnterior = useRef<string | null>(null);
  useEffect(() => {
    if (sugestao && !sugestaoAnterior.current) rolarParaVista(sugestaoRef.current, { block: 'nearest' });
    sugestaoAnterior.current = sugestao;
  }, [sugestao]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-texto-2"><span aria-hidden className="text-danger">*</span> Campos obrigatórios</p>

      <Campo
        id="nome" rotulo="Nome completo" obrigatorio
        autoComplete="name" autoCapitalize="words"
        value={dados.nome} erro={erros.nome}
        onChange={(e) => aoMudar('nome', e.target.value)}
        onBlur={() => aoSair('nome')}
      />

      <Campo
        id="telefone" rotulo="Celular / WhatsApp" obrigatorio
        type="tel" inputMode="tel" autoComplete="tel-national"
        placeholder="(11) 91234-5678"
        value={dados.telefone} erro={erros.telefone}
        onChange={(e) => aoMudar('telefone', mascararTelefone(e.target.value))}
        onBlur={() => aoSair('telefone')}
      />

      <Campo
        id="email" rotulo="E-mail" obrigatorio
        type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
        value={dados.email} erro={erros.email}
        onChange={(e) => aoMudar('email', e.target.value)}
        onBlur={() => aoSair('email')}
        extra={sugestao && (
          <p ref={sugestaoRef} className="mt-2 text-sm text-texto-2" role="status">
            Você quis dizer <strong className="font-medium text-texto">{sugestao}</strong>?{' '}
            <button
              type="button"
              onClick={() => aoMudar('email', sugestao)}
              className="inline-flex min-h-11 items-center font-medium text-acento underline underline-offset-4"
            >
              Corrigir
            </button>
          </p>
        )}
      />

      <CampoTexto
        id="motivo" rotulo="Motivo da consulta"
        rows={3} maxLength={500}
        placeholder="Ex.: primeira consulta, resultado de exames…"
        value={dados.motivo} erro={erros.motivo}
        ajuda={<>Ajuda a médica a se preparar. <span className="tabular">{dados.motivo.length}/500</span></>}
        onChange={(e) => {
          aoMudar('motivo', e.target.value);
          // Sem motivo, não há dado de saúde a consentir.
          if (!e.target.value.trim() && dados.consentimentoSaude) aoMudar('consentimentoSaude', false);
        }}
        onBlur={() => aoSair('motivo')}
      />

      <fieldset className="space-y-4 border-t border-borda pt-6">
        <legend className="sr-only">Autorizações</legend>

        <Consentimento
          id="consentimentoDados"
          marcado={dados.consentimentoDados}
          erro={erros.consentimentoDados}
          aoMudar={(v) => aoMudar('consentimentoDados', v)}
        >
          {CONSENTIMENTO.dados.texto}{' '}
          <Link href="/politica-de-privacidade" target="_blank" className="font-medium text-acento underline underline-offset-4">
            {CONSENTIMENTO.dados.link}
          </Link>. <span aria-hidden className="text-danger">*</span>
        </Consentimento>

        {/* LGPD Art. 11: dado de saúde exige consentimento ESPECÍFICO e
            DESTACADO. Só aparece quando existe dado de saúde a consentir. */}
        {temMotivo && (
          <Consentimento
            id="consentimentoSaude"
            marcado={dados.consentimentoSaude}
            erro={erros.consentimentoSaude}
            aoMudar={(v) => aoMudar('consentimentoSaude', v)}
            destaque
          >
            {CONSENTIMENTO.saude.antes} <strong className="font-medium text-texto">{CONSENTIMENTO.saude.destaque}</strong>
            {CONSENTIMENTO.saude.depois}
          </Consentimento>
        )}
      </fieldset>
    </div>
  );
}

function Consentimento({ id, marcado, erro, aoMudar, destaque, children }: {
  id: string; marcado: boolean; erro?: string; aoMudar: (v: boolean) => void;
  destaque?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={destaque ? 'rounded-md border border-oliva-500/50 bg-superficie p-4' : ''}>
      {/* O rótulo inteiro é a área de toque — o checkbox sozinho é pequeno. */}
      <label htmlFor={id} className="flex cursor-pointer gap-3.5 text-sm text-texto-2">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={marcado}
          onChange={(e) => aoMudar(e.target.checked)}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className="mt-0.5 size-6 min-h-0 shrink-0 cursor-pointer accent-floresta-900"
        />
        <span className="leading-relaxed">{children}</span>
      </label>
      {erro && <p id={`${id}-erro`} role="alert" className="mt-2 pl-[2.375rem] text-sm text-danger">{erro}</p>}
    </div>
  );
}
