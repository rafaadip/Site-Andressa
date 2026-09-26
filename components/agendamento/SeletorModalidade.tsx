import { Check, MapPin, Video } from 'lucide-react';
import type { TipoConsultaPublico } from '@/lib/agendamento/tipos';
import { localConsulta } from '@/lib/config';
import { navegarRadio } from './navegacao-radio';

const DESCRICAO = {
  in_person: 'No consultório, com exame físico e avaliação completa.',
  telehealth: 'Por vídeo, de onde você estiver. O link chega antes da consulta.',
} as const;

type Props = {
  tipos: TipoConsultaPublico[];
  selecionado: string | null;
  aoSelecionar: (slug: string) => void;
  erro?: string;
};

/**
 * Selecionar NÃO avança sozinho: toque acidental é comum no celular, e o
 * avanço automático tira o controle de quem está escolhendo.
 */
export function SeletorModalidade({ tipos, selecionado, aoSelecionar, erro }: Props) {
  // Roving tabindex: só a opção selecionada (ou a primeira) entra no Tab.
  const focavel = selecionado ?? tipos[0]?.slug;

  return (
    <div>
      <div
        id="grupo-modalidade"
        tabIndex={-1}
        role="radiogroup"
        aria-label="Modalidade da consulta"
        aria-describedby={erro ? 'erro-modalidade' : undefined}
        onKeyDown={navegarRadio}
        className="grid gap-3 md:grid-cols-2 md:gap-4"
      >
        {tipos.map((t) => {
          const ativo = selecionado === t.slug;
          const Icone = t.modalidade === 'telehealth' ? Video : MapPin;
          return (
            <button
              key={t.slug}
              type="button"
              role="radio"
              aria-checked={ativo}
              tabIndex={t.slug === focavel ? 0 : -1}
              onClick={() => aoSelecionar(t.slug)}
              className={`relative flex min-h-24 flex-col items-start gap-1 rounded-lg border p-5 text-left
                          transition-colors duration-200
                          ${ativo
                            ? 'border-floresta-900 bg-superficie ring-1 ring-floresta-900'
                            : 'border-borda-campo bg-elevado hover:border-ink'}`}
            >
              <span className="flex w-full items-center gap-3">
                <span aria-hidden className={`grid size-10 place-items-center rounded-full ${ativo ? 'bg-floresta-900 text-ivory-100' : 'bg-sand-200 text-oliva-700'}`}>
                  {ativo ? <Check size={20} strokeWidth={2} /> : <Icone size={20} strokeWidth={1.5} />}
                </span>
                <span className="font-medium text-[1.0625rem] text-texto">{t.label}</span>
                <span className="ml-auto text-sm text-texto-2 tabular">{t.duracaoMin} min</span>
              </span>
              <span className="mt-2 text-sm text-texto-2">{DESCRICAO[t.modalidade]}</span>
              {t.modalidade === 'in_person' && (
                <span className="text-sm text-texto-2">{localConsulta('in_person')}</span>
              )}
            </button>
          );
        })}
      </div>
      {erro && <p id="erro-modalidade" role="alert" className="mt-3 text-sm text-danger">{erro}</p>}
    </div>
  );
}
