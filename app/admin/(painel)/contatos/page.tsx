import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirAdmin } from '@/lib/auth/admin';
import { listarContatos } from '@/lib/contatos/servico';
import { CONTATO_RETENCAO_DIAS, FORMULARIO_CONTATO } from '@/lib/content/site';
import { linkWhatsAppDoPaciente } from '@/lib/contato';
import { formatarCurto } from '@/lib/datetime';
import { CartaoContato, type ContatoParaCartao } from '@/components/admin/CartaoContato';

export const metadata: Metadata = { title: 'Contatos' };

const rotuloDe = (lista: readonly { id: string; rotulo: string }[], id: string | null) =>
  (id ? lista.find((i) => i.id === id)?.rotulo ?? id : null);

/**
 * Pedidos do formulário de contato da home. Pendentes primeiro (o padrão);
 * "Todos" mostra também os já retornados. Cada pedido some sozinho em
 * CONTATO_RETENCAO_DIAS dias (lib/lgpd/retencao.ts).
 */
export default async function Contatos({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  // Defesa em profundidade: a página confere a sessão por conta própria (SEC-15).
  await exigirAdmin();
  const todos = (await searchParams).ver === 'todos';
  const linhas = await listarContatos({ pendentes: !todos });

  const contatos: ContatoParaCartao[] = linhas.map((l) => ({
    id: l.id,
    nome: `${l.firstName} ${l.lastName}`,
    idade: l.age,
    email: l.email,
    telefone: l.phone,
    whatsapp: linkWhatsAppDoPaciente(l.phone),
    horario: rotuloDe(FORMULARIO_CONTATO.horarios, l.preferredPeriod),
    motivo: rotuloDe(FORMULARIO_CONTATO.motivos, l.reason) ?? l.reason,
    recebidoEm: formatarCurto(l.createdAt),
    atendido: l.handledAt !== null,
  }));

  const aba = (ativo: boolean) =>
    `inline-flex min-h-11 items-center rounded-full px-4 text-sm ${ativo ? 'bg-superficie font-medium text-texto' : 'text-texto-2 hover:text-texto'}`;

  return (
    <div className="mx-auto max-w-[48rem]">
      <h1 className="display text-h3 text-texto">Contatos do site</h1>
      <p className="mt-1 text-sm text-texto-2">
        Pedidos do formulário da página inicial. A pessoa também foi levada ao WhatsApp do consultório.
        Cada pedido é apagado sozinho {CONTATO_RETENCAO_DIAS} dias depois de chegar.
      </p>

      <nav aria-label="Filtro de contatos" className="mt-5 flex gap-1">
        <Link href="/admin/contatos" aria-current={!todos ? 'page' : undefined} className={aba(!todos)}>Pendentes</Link>
        <Link href="/admin/contatos?ver=todos" aria-current={todos ? 'page' : undefined} className={aba(todos)}>Todos</Link>
      </nav>

      <section aria-label={todos ? 'Todos os contatos' : 'Contatos pendentes'} className="mt-5">
        {contatos.length === 0 ? (
          <p className="rounded-lg border border-borda bg-superficie p-5 text-texto-2">
            {todos ? 'Nenhum contato recebido.' : 'Nenhum contato pendente.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {contatos.map((c) => <li key={c.id}><CartaoContato c={c} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
