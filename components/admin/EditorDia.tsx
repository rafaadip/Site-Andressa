'use client';

import { useActionState, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { acaoSalvarDia, type Estado } from '@/app/admin/(painel)/acoes';
import type { Faixa } from '@/lib/agendamento/admin';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

const MODALIDADES = [
  { valor: 'in_person', rotulo: 'Presencial' },
  { valor: 'telehealth', rotulo: 'Teleconsulta' },
  { valor: 'ambas', rotulo: 'As duas' },
] as const;

/**
 * Faixas de um dia da semana. O modelo é faixa de horário (não grade fixa
 * de manhã/tarde/noite): representa exatamente o que o banco guarda.
 */
export function EditorDia({ dia, nome, inicial }: { dia: number; nome: string; inicial: Faixa[] }) {
  const [faixas, setFaixas] = useState<Faixa[]>(inicial);
  const [estado, acao] = useActionState<Estado, FormData>(acaoSalvarDia, null);
  const mudar = (i: number, f: Partial<Faixa>) => setFaixas((l) => l.map((x, j) => (j === i ? { ...x, ...f } : x)));
  const idBase = `dia-${dia}`;

  return (
    <form action={acao} className="rounded-lg border border-borda bg-elevado p-4 md:p-5">
      <input type="hidden" name="dia" value={dia} />
      <input type="hidden" name="faixas" value={JSON.stringify(faixas)} />
      <h3 className="font-medium text-texto">{nome}</h3>
      {faixas.length === 0 && <p className="mt-2 text-sm text-texto-2">Sem atendimento.</p>}
      <ul className="mt-3 space-y-3">
        {faixas.map((f, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 md:grid-cols-[8rem_8rem_1fr_auto]">
            <label className="text-sm text-texto-2" htmlFor={`${idBase}-${i}-ini`}>Das
              <input id={`${idBase}-${i}-ini`} type="time" step={300} value={f.inicio} required
                onChange={(e) => mudar(i, { inicio: e.target.value })}
                className="mt-1 block min-h-12 w-full rounded-md border border-borda-campo bg-elevado px-3 text-base text-texto tabular" />
            </label>
            <label className="text-sm text-texto-2" htmlFor={`${idBase}-${i}-fim`}>às
              <input id={`${idBase}-${i}-fim`} type="time" step={300} value={f.fim} required
                onChange={(e) => mudar(i, { fim: e.target.value })}
                className="mt-1 block min-h-12 w-full rounded-md border border-borda-campo bg-elevado px-3 text-base text-texto tabular" />
            </label>
            <button type="button" onClick={() => setFaixas((l) => l.filter((_, j) => j !== i))}
              aria-label={`Remover faixa ${f.inicio}–${f.fim}`}
              className="grid size-12 place-items-center rounded-full border border-borda-campo text-texto md:order-last">
              <X aria-hidden size={18} />
            </button>
            <label className="col-span-3 text-sm text-texto-2 md:col-span-1" htmlFor={`${idBase}-${i}-mod`}>Modalidade
              <select id={`${idBase}-${i}-mod`} value={f.modalidade}
                onChange={(e) => mudar(i, { modalidade: e.target.value as Faixa['modalidade'] })}
                className="mt-1 block min-h-12 w-full rounded-md border border-borda-campo bg-elevado px-3 text-base text-texto">
                {MODALIDADES.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
              </select>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <button type="button"
          onClick={() => setFaixas((l) => [...l, { inicio: l.at(-1)?.fim ?? '09:00', fim: '12:00', modalidade: 'in_person' }])}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-acento">
          <Plus aria-hidden size={16} />Adicionar faixa
        </button>
        <BotaoEnviar variante="contorno">Salvar {nome.toLowerCase()}</BotaoEnviar>
      </div>
      <Resultado estado={estado} />
    </form>
  );
}
