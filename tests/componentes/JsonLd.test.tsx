// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { JsonLd } from '@/components/site/JsonLd';

afterEach(cleanup);

describe('<JsonLd>', () => {
  it('serializa os dados como JSON válido dentro de um <script type="application/ld+json">', () => {
    const dados = { '@context': 'https://schema.org', '@type': 'Physician', name: 'Dra. Andressa' };
    const { container } = render(<JsonLd dados={dados} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    expect(JSON.parse(script!.innerHTML)).toEqual(dados);
  });

  it('escapa "<" para impedir que uma string do dado feche a tag <script>', () => {
    const dados = { descricao: '</script><script>alert(1)</script>' };
    const { container } = render(<JsonLd dados={dados} />);
    const script = container.querySelector('script[type="application/ld+json"]')!;
    // O HTML servido nunca contém "<" cru vindo do dado.
    expect(script.innerHTML).not.toContain('</script><script>');
    expect(script.innerHTML).toContain('\\u003cscript>');
    // E o valor original é recuperável ao interpretar o JSON.
    expect(JSON.parse(script.innerHTML)).toEqual(dados);
  });
});
