import { describe, it, expect } from 'vitest';
import { jsonLdProfissional, jsonLdFaq } from '@/lib/seo';
import { FAQ } from '@/lib/content/site';

describe('JSON-LD do profissional', () => {
  const ld = jsonLdProfissional();
  const texto = JSON.stringify(ld);

  it('é do tipo Physician com nome e telefone', () => {
    expect(ld['@type']).toBe('Physician');
    expect(ld.name).toBe('Dra. Andressa Chaves Correia');
    expect(ld.telephone).toBe('+5511998053826');
  });

  it('sem endereço definido, publica só cidade/UF — nunca endereço inventado', () => {
    expect(ld.address).not.toHaveProperty('streetAddress');
    expect(ld.address).not.toHaveProperty('postalCode');
    expect(ld.address.addressLocality).toBe('Guarulhos');
  });

  it('não alega especialidade nem avaliações', () => {
    expect(texto).not.toMatch(/medicalSpecialty/);
    expect(texto).not.toMatch(/AggregateRating|"Review"/);
    expect(texto.toLowerCase()).not.toContain('especialista');
  });

  it('não vaza undefined nem null', () => {
    expect(texto).not.toContain('undefined');
    expect(texto).not.toContain('null');
  });
});

describe('JSON-LD do FAQ', () => {
  it('espelha todas as perguntas do conteúdo', () => {
    const ld = jsonLdFaq();
    expect(ld.mainEntity).toHaveLength(FAQ.length);
    expect(ld.mainEntity[0]?.acceptedAnswer.text).toBe(FAQ[0].resposta);
  });
});
