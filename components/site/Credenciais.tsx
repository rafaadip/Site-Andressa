import { PROFISSIONAL } from '@/lib/config';
import { CREDENCIAIS } from '@/lib/content/site';

/** 1 coluna no celular · 2 no tablet · 4 no desktop. */
export function Credenciais() {
  // O CRM vem do config — nunca escrito à mão (check:conformidade).
  const itens = [
    { titulo: PROFISSIONAL.crm, detalhe: 'Conselho Regional de Medicina' },
    ...CREDENCIAIS,
  ];
  return (
    <section aria-label="Credenciais" className="bg-superficie border-b border-borda">
      <ul className="wrap grid gap-x-8 gap-y-5 py-8 md:grid-cols-2 lg:grid-cols-4 lg:py-9">
        {itens.map((c) => (
          <li key={c.titulo} className="flex gap-3.5">
            <span aria-hidden className="mt-[.55rem] size-2 shrink-0 rounded-full bg-gold-500" />
            <p>
              <strong className="block font-medium text-texto">{c.titulo}</strong>
              <span className="text-sm text-texto-2">{c.detalhe}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
