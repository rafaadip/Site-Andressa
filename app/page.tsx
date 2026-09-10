import { PROFISSIONAL, tituloPublico, localConsulta } from '@/lib/config';

/**
 * Casca temporária — a home completa é a FASE-03.
 * Serve para validar tokens, fontes e o esqueleto mobile-first.
 */
export default function Home() {
  return (
    <main id="conteudo">
      <section className="superficie-escura" style={{ paddingBlock: 'var(--section-y)' }}>
        <div className="wrap">
          <p className="eyebrow">Nutrologia · {PROFISSIONAL.cidade} – {PROFISSIONAL.uf}</p>
          <h1 className="display" style={{ fontSize: 'var(--text-display)', margin: '.5em 0' }}>
            Medicina com escuta, tempo e cuidado.
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '46ch' }}>
            {tituloPublico()} · {PROFISSIONAL.crm}
          </p>
        </div>
      </section>

      <section style={{ paddingBlock: 'var(--section-y)' }}>
        <div className="wrap">
          <p className="eyebrow">Atendimento</p>
          <h2 className="display" style={{ fontSize: 'var(--text-h2)', margin: '.4em 0' }}>
            Em construção
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '68ch' }}>
            Consulta presencial: {localConsulta('in_person')}.
          </p>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '68ch' }}>
            {localConsulta('telehealth')}.
          </p>
        </div>
      </section>
    </main>
  );
}
