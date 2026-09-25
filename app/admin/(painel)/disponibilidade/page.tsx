import type { Metadata } from 'next';
import Link from 'next/link';
import { Ban, Plus, Trash2 } from 'lucide-react';
import { listarExcecoes, listarRegras, type Faixa, type Regra } from '@/lib/agendamento/admin';
import { dataLocal, formatarCurto } from '@/lib/datetime';
import { EditorDia } from '@/components/admin/EditorDia';
import { FormExtra } from '@/components/admin/FormExtra';
import { acaoRemoverExcecao } from '../acoes';

export const metadata: Metadata = { title: 'Horários' };

/** Semana começa na segunda — é como a agenda dela é lida. */
const DIAS = [
  { n: 1, nome: 'Segunda' }, { n: 2, nome: 'Terça' }, { n: 3, nome: 'Quarta' }, { n: 4, nome: 'Quinta' },
  { n: 5, nome: 'Sexta' }, { n: 6, nome: 'Sábado' }, { n: 0, nome: 'Domingo' },
];

/** Regras do banco → faixas do editor ("presencial" + "tele" iguais = "as duas"). */
function faixasDoDia(regras: Regra[], dia: number): Faixa[] {
  const doDia = regras.filter((r) => r.diaSemana === dia);
  const faixas: Faixa[] = [];
  for (const r of doDia) {
    const par = faixas.find((f) => f.inicio === r.inicio && f.fim === r.fim && f.modalidade !== r.modalidade && f.modalidade !== 'ambas');
    if (par) par.modalidade = 'ambas';
    else faixas.push({ inicio: r.inicio, fim: r.fim, modalidade: r.modalidade });
  }
  return faixas.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export default async function Disponibilidade({ searchParams }: { searchParams: Promise<{ feito?: string }> }) {
  const { feito } = await searchParams;
  const [regras, excecoes] = await Promise.all([listarRegras(), listarExcecoes()]);
  const hoje = dataLocal(new Date());

  return (
    <div className="mx-auto max-w-[46rem]">
      <h1 className="display text-h3 text-texto">Horários de atendimento</h1>
      {feito === 'bloqueado' && <p role="status" className="mt-4 rounded-md bg-superficie p-3 text-sm text-texto">Período bloqueado.</p>}

      <section aria-labelledby="titulo-excecoes" className="mt-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 id="titulo-excecoes" className="font-medium text-texto">Bloqueios e extras</h2>
          <Link href="/admin/disponibilidade/bloquear" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-espresso-900 bg-espresso-900 px-6 font-medium text-ivory-100">
            <Ban aria-hidden size={18} />Bloquear período
          </Link>
        </div>
        {excecoes.length === 0
          ? <p className="mt-3 text-sm text-texto-2">Nenhum bloqueio ou horário extra daqui para a frente.</p>
          : (
            <ul className="mt-3 divide-y divide-borda border-y border-borda">
              {excecoes.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-3">
                  <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-full ${x.tipo === 'block' ? 'bg-sand-200 text-danger' : 'bg-sand-200 text-success'}`}>
                    {x.tipo === 'block' ? <Ban size={16} /> : <Plus size={16} />}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-texto">{x.tipo === 'block' ? 'Bloqueio' : 'Horário extra'}{x.nota ? ` · ${x.nota}` : ''}</p>
                    <p className="text-texto-2 first-letter:uppercase">{formatarCurto(x.inicio)} até {formatarCurto(x.fim)}</p>
                  </div>
                  <form action={acaoRemoverExcecao}>
                    <input type="hidden" name="id" value={x.id} />
                    <button type="submit" aria-label={`Remover ${x.tipo === 'block' ? 'bloqueio' : 'horário extra'} de ${formatarCurto(x.inicio)}`}
                      className="grid size-11 place-items-center rounded-full border border-borda-campo text-texto">
                      <Trash2 aria-hidden size={16} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        <div className="mt-4"><FormExtra hoje={hoje} /></div>
      </section>

      <section aria-labelledby="titulo-semana" className="mt-10">
        <h2 id="titulo-semana" className="font-medium text-texto">Semana padrão</h2>
        <p className="mt-1 text-sm text-texto-2">Faixas em que o site oferece horários. Plantões e compromissos da sua agenda do Google são descontados automaticamente.</p>
        <div className="mt-4 space-y-3">
          {DIAS.map((d) => <EditorDia key={d.n} dia={d.n} nome={d.nome} inicial={faixasDoDia(regras, d.n)} />)}
        </div>
      </section>
    </div>
  );
}
