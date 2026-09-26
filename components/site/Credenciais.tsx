import { PROFISSIONAL } from '@/lib/config';
import { CREDENCIAIS } from '@/lib/content/site';

/**
 * Credenciais num painel de vidro que "atravessa" a fronteira entre o hero
 * e a seção seguinte — a prova de confiança que o paciente procura
 * primeiro, logo abaixo da ação principal. Fatos, sem adjetivo.
 * 2 colunas no celular e no tablet · 4 no desktop.
 *
 * Movimento: no desktop o painel está na 1ª dobra e entra por último na
 * coreografia do hero (`entrada-credenciais`). No celular ele nasce abaixo
 * da dobra e quem o revela, ao rolar, é o Revelar.
 */
export function Credenciais() {
  // O CRM vem do config — nunca escrito à mão (check:conformidade).
  const itens = [
    { titulo: PROFISSIONAL.crm, detalhe: 'Conselho Regional de Medicina' },
    ...CREDENCIAIS,
  ];
  return (
    <section
      aria-label="Credenciais"
      className="relative z-10 -mt-20 md:-mt-24 lg:-mt-28"
    >
      <div className="wrap">
        <ul data-revelar className="vidro entrada-credenciais grid grid-cols-2 rounded-[1.75rem] px-2 md:px-4 lg:grid-cols-4 lg:px-2">
          {itens.map((c, i) => (
            <li
              key={c.titulo}
              className={`px-3 py-5 md:px-4 md:py-7 lg:px-7 lg:py-8
                          ${i >= 2 ? 'border-t border-borda lg:border-t-0' : ''}
                          ${i % 2 === 1 ? 'border-l border-borda' : ''}
                          ${i === 2 ? 'lg:border-l' : ''}`}
            >
              <p>
                <strong className="block font-display font-normal text-[1.0625rem] leading-snug text-texto md:text-[1.1875rem] lg:text-[1.3125rem]">
                  {c.titulo}
                </strong>
                <span className="mt-1.5 block text-sm leading-snug text-texto-2">{c.detalhe}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
