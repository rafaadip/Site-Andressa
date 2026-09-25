import type { Metadata } from 'next';
import { exigirAdmin } from '@/lib/auth/admin';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { afetadosPor, periodoDoFormulario, restoDeHoje } from '@/lib/agendamento/admin';
import { dataLocal, formatarCurto, horaLocal, DataInvalidaError } from '@/lib/datetime';
import { FormBloquear } from '@/components/admin/FormBloquear';

export const metadata: Metadata = { title: 'Bloquear período' };

const CAMPO = 'mt-1 block min-h-12 w-full rounded-md border border-borda-campo bg-elevado px-3 text-base text-texto';

type Busca = { resto?: string; de?: string; ate?: string; hi?: string; hf?: string; diaInteiro?: string; nota?: string };

export default async function Bloquear({ searchParams }: { searchParams: Promise<Busca> }) {
  // Defesa em profundidade: o layout pode não reexecutar numa navegação
  // parcial; a página confere a sessão por conta própria (SEC-15).
  await exigirAdmin();
  const b = await searchParams;
  const hoje = dataLocal(new Date());

  let periodo: { inicio: Date; fim: Date } | null = null;
  let erro: string | null = null;
  try {
    if (b.resto) periodo = restoDeHoje();
    else if (b.de && /^\d{4}-\d{2}-\d{2}$/.test(b.de)) {
      periodo = periodoDoFormulario({ de: b.de, ate: b.ate || undefined, hi: b.hi, hf: b.hf, diaInteiro: b.diaInteiro === 'on' });
      if (periodo.fim <= periodo.inicio) { erro = 'O fim precisa ser depois do início.'; periodo = null; }
    }
  } catch (e) {
    if (!(e instanceof DataInvalidaError)) throw e;
    erro = 'Data ou hora inválida.';
  }
  const nota = b.resto ? 'Resto do dia' : (b.nota ?? '').slice(0, 120);
  const afetados = periodo ? await afetadosPor(periodo.inicio, periodo.fim) : [];

  return (
    <div className="mx-auto max-w-[40rem]">
      <Link href="/admin/disponibilidade" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-acento"><ArrowLeft aria-hidden size={16} />Horários</Link>
      <h1 className="display mt-3 text-h3 text-texto">Bloquear período</h1>
      <p className="mt-1 text-sm text-texto-2">Nenhum horário será oferecido no site dentro do bloqueio.</p>

      {!periodo && (
        // GET: o passo 1 só descreve o período; nada é gravado até confirmar.
        <form method="get" className="mt-6 space-y-4 rounded-lg border border-borda bg-elevado p-4 md:p-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-texto-2">De<input type="date" name="de" min={hoje} defaultValue={b.de ?? hoje} required className={CAMPO} /></label>
            <label className="text-sm text-texto-2">Até<input type="date" name="ate" min={hoje} defaultValue={b.ate} className={CAMPO} /></label>
            <label className="text-sm text-texto-2">A partir de<input type="time" name="hi" step={300} defaultValue={b.hi} className={`${CAMPO} tabular`} /></label>
            <label className="text-sm text-texto-2">Até as<input type="time" name="hf" step={300} defaultValue={b.hf} className={`${CAMPO} tabular`} /></label>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-texto">
            <input type="checkbox" name="diaInteiro" defaultChecked={b.diaInteiro === 'on'} className="size-6 accent-espresso-900" />Dia(s) inteiro(s)
          </label>
          <label className="block text-sm text-texto-2">Nota (só você vê)<input type="text" name="nota" maxLength={120} placeholder="Ex.: plantão, congresso, férias" defaultValue={b.nota} className={CAMPO} /></label>
          {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
          <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-espresso-900 bg-espresso-900 px-6 font-medium text-ivory-100 md:w-auto">Continuar</button>
        </form>
      )}

      {periodo && (
        <>
          <dl className="mt-6 rounded-lg border border-borda bg-superficie p-4 text-sm">
            <div className="flex gap-2"><dt className="text-texto-2">De</dt><dd className="font-medium text-texto first-letter:uppercase">{formatarCurto(periodo.inicio)}</dd></div>
            <div className="flex gap-2"><dt className="text-texto-2">Até</dt><dd className="font-medium text-texto first-letter:uppercase">{formatarCurto(periodo.fim)}</dd></div>
            {nota && <div className="flex gap-2"><dt className="text-texto-2">Nota</dt><dd className="text-texto">{nota}</dd></div>}
          </dl>
          <FormBloquear
            inicio={periodo.inicio.toISOString()} fim={periodo.fim.toISOString()} nota={nota}
            afetados={afetados.map((a) => ({ id: a.id, hora: `${formatarCurto(a.inicio)}`, nome: a.nome, tipo: `${a.tipo} · ${horaLocal(a.inicio)}` }))}
          />
        </>
      )}
    </div>
  );
}
