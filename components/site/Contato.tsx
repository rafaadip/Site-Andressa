import { Mail, MapPin, MessageCircle, TriangleAlert } from 'lucide-react';
import { PROFISSIONAL, localConsulta } from '@/lib/config';
import { linkWhatsApp } from '@/lib/contato';
import { URGENCIA } from '@/lib/content/site';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';

export function Contato() {
  const itens = [
    {
      Icone: MessageCircle, rotulo: 'WhatsApp',
      valor: PROFISSIONAL.telefoneExibicao, href: linkWhatsApp(), externo: true,
    },
    {
      Icone: Mail, rotulo: 'E-mail',
      valor: PROFISSIONAL.email, href: `mailto:${PROFISSIONAL.email}`, externo: false,
    },
    {
      // Endereço ainda não definido: localConsulta() degrada sozinho (FASE-03 §3.1).
      Icone: MapPin, rotulo: 'Consultório',
      valor: localConsulta('in_person'), href: PROFISSIONAL.endereco?.mapsUrl ?? null, externo: true,
    },
  ];

  return (
    <Secao id="contato" superficie>
      <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-24">
        <div>
          <CabecalhoSecao eyebrow="Contato" titulo="Fale com o consultório" />
          <ul className="border-t border-borda">
            {itens.map(({ Icone, rotulo, valor, href, externo }) => (
              <li key={rotulo} data-revelar className="group flex items-center gap-5 border-b border-borda py-5">
                <span
                  aria-hidden
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-sand-200 text-oliva-700 transition-[background-color,color] duration-500
                             group-hover:bg-floresta-900 group-hover:text-oliva-200"
                >
                  <Icone size={20} strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <p className="eyebrow">{rotulo}</p>
                  {href ? (
                    <a
                      href={href}
                      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="link-fio inline-flex min-h-11 items-center text-[1.125rem] text-texto break-all"
                    >
                      {valor}
                    </a>
                  ) : (
                    <p className="mt-1 text-[1.0625rem] leading-snug text-texto">{valor}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Conteúdo de SEGURANÇA, não rodapé decorativo: ícone + texto, nunca só cor. */}
        <aside
          aria-labelledby="titulo-urgencia"
          data-revelar
          className="self-start rounded-[1.25rem] border border-borda bg-elevado p-7 shadow-sm md:p-8 lg:mt-[7.5rem]"
        >
          <div className="flex gap-4">
            <TriangleAlert aria-hidden size={24} strokeWidth={1.75} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <h3 id="titulo-urgencia" className="font-medium text-texto">{URGENCIA.titulo}</h3>
              <p className="mt-2 text-texto-2 leading-relaxed">
                {URGENCIA.texto} <strong className="font-medium text-texto">{URGENCIA.telefone}</strong>.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </Secao>
  );
}
