/**
 * Dados estruturados (schema.org) — docs/fases/FASE-11-seo-performance.md §2
 *
 * Regras:
 *  - SEM `medicalSpecialty`: mesmo descrevendo serviço, pode ser lido como
 *    alegação de especialidade enquanto não houver RQE (FASE-10).
 *  - SEM `AggregateRating`/`Review`: CFM restringe depoimento de paciente, e
 *    marcar avaliação inexistente viola as diretrizes do Google.
 *  - Endereço só com o que é VERDADE: sem endereço definido, apenas cidade/UF.
 *    Nunca endereço aproximado — engana o paciente e quebra o NAP.
 */
import { PROFISSIONAL } from './config';
import { FAQ } from './content/site';

export function urlSite(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function jsonLdProfissional() {
  const e = PROFISSIONAL.endereco;
  const url = urlSite();

  return {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    '@id': `${url}/#profissional`,
    name: PROFISSIONAL.nome,
    url,
    image: `${url}/retratos/andressa-circular.png`,
    telephone: PROFISSIONAL.telefone,
    email: PROFISSIONAL.email,
    address: {
      '@type': 'PostalAddress',
      ...(e ? { streetAddress: `${e.logradouro}, ${e.numero}${e.complemento ? `, ${e.complemento}` : ''}`, postalCode: e.cep } : {}),
      addressLocality: PROFISSIONAL.cidade,
      addressRegion: PROFISSIONAL.uf,
      addressCountry: 'BR',
    },
    areaServed: [
      { '@type': 'City', name: 'Guarulhos' },
      { '@type': 'City', name: 'São Paulo' },
    ],
    availableService: [
      { '@type': 'MedicalProcedure', name: 'Consulta em Nutrologia' },
      { '@type': 'MedicalProcedure', name: 'Teleconsulta' },
    ],
    potentialAction: {
      '@type': 'ReserveAction',
      target: `${url}/agendar`,
    },
  };
}

export function jsonLdFaq() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta },
    })),
  };
}
