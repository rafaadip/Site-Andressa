import type { Metadata } from 'next';
import { exigirAdmin } from '@/lib/auth/admin';
import { listarTiposAdmin } from '@/lib/agendamento/admin';
import { profissional } from '@/lib/agendamento/servico';
import { FormPoliticas } from '@/components/admin/FormPoliticas';
import { FormTipo } from '@/components/admin/FormTipo';

export const metadata: Metadata = { title: 'Ajustes' };

export default async function Configuracoes() {
  // Defesa em profundidade: o layout pode não reexecutar numa navegação
  // parcial; a página confere a sessão por conta própria (SEC-15).
  await exigirAdmin();
  const [tipos, prof] = await Promise.all([listarTiposAdmin(), profissional()]);
  return (
    <div className="mx-auto max-w-[40rem]">
      <h1 className="display text-h3 text-texto">Ajustes</h1>

      <section aria-labelledby="titulo-politicas" className="mt-6">
        <h2 id="titulo-politicas" className="mb-3 font-medium text-texto">Políticas de agendamento</h2>
        <FormPoliticas p={{
          lead: prof.leadTimeHours, horizonte: prof.horizonDays, prazo: prof.cancelDeadlineHours,
          sala: prof.telehealthUrl ?? '', motivoNoEvento: prof.includeNoteInEvent,
        }} />
      </section>

      <section aria-labelledby="titulo-modalidades" className="mt-10">
        <h2 id="titulo-modalidades" className="font-medium text-texto">Modalidades</h2>
        <p className="mt-1 mb-3 text-sm text-texto-2">Mudar a duração vale só para as próximas consultas; as já marcadas mantêm o horário.</p>
        <div className="space-y-3">
          {tipos.map((t) => (
            <FormTipo key={t.id} t={{
              id: t.id, label: t.label, duracao: t.durationMin, antes: t.bufferBeforeMin,
              depois: t.bufferAfterMin, ativo: t.isActive, modalidade: t.locationKind,
            }} />
          ))}
        </div>
      </section>
    </div>
  );
}
