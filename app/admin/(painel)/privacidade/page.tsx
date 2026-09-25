import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { consultasDoTitular } from '@/lib/agendamento/admin';
import { formatarCurto } from '@/lib/datetime';
import { FormAnonimizar } from '@/components/admin/FormAnonimizar';

export const metadata: Metadata = { title: 'Privacidade' };

const STATUS: Record<string, string> = { confirmed: 'confirmada', cancelled: 'cancelada', no_show: 'faltou', completed: 'realizada', expired: 'expirada' };

/**
 * Direitos do titular (LGPD Art. 18) — FASE-10 §3.4: acesso/portabilidade
 * (exportação JSON e CSV) e eliminação (anonimização).
 */
export default async function Privacidade({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const email = ((await searchParams).email ?? '').trim().toLowerCase().slice(0, 254);
  const linhas = email ? await consultasDoTitular(email) : [];
  const ativas = linhas.filter((l) => !l.ag.anonymizedAt);

  return (
    <div className="mx-auto max-w-[40rem]">
      <h1 className="display text-h3 text-texto">Pedidos de titulares</h1>
      <p className="mt-1 text-sm text-texto-2">Quando alguém pedir acesso, cópia ou exclusão dos próprios dados. Prazo de resposta: 15 dias.</p>

      <form method="get" className="mt-6 flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1 text-sm text-texto-2">E-mail do titular
          <input type="email" name="email" defaultValue={email} required autoComplete="off"
            className="mt-1 block min-h-12 w-full rounded-md border border-borda-campo bg-elevado px-3 text-base text-texto" />
        </label>
        <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-full border border-espresso-900 bg-espresso-900 px-6 font-medium text-ivory-100">Buscar</button>
      </form>

      {email && (
        <section aria-labelledby="titulo-resultado" className="mt-8">
          <h2 id="titulo-resultado" className="font-medium text-texto">{ativas.length} consulta(s) com dados</h2>
          {linhas.length > 0 && (
            <ul className="mt-3 divide-y divide-borda border-y border-borda text-sm">
              {linhas.map(({ ag, tipo }) => (
                <li key={ag.id} className="py-3">
                  <p className="text-texto first-letter:uppercase">{formatarCurto(ag.visitStartsAt)} · {tipo} · {STATUS[ag.status] ?? ag.status}</p>
                  <p className="text-texto-2">{ag.anonymizedAt ? 'Dados já eliminados' : `${ag.patientName}${ag.patientNote ? ' · com motivo informado' : ''}`}</p>
                </li>
              ))}
            </ul>
          )}
          {ativas.length > 0 && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row">
                {(['json', 'csv'] as const).map((f) => (
                  <a key={f} href={`/admin/exportar?email=${encodeURIComponent(email)}&formato=${f}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-borda-campo px-6 font-medium text-texto">
                    <Download aria-hidden size={18} />Exportar {f.toUpperCase()}
                  </a>
                ))}
              </div>
              <FormAnonimizar email={email} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
