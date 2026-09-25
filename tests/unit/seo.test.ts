import { describe, it, expect, afterEach } from 'vitest';
import { jsonLdProfissional, jsonLdFaq } from '@/lib/seo';
import { PROFISSIONAL, localConsulta, type Endereco } from '@/lib/config';
import { gerarIcs } from '@/lib/calendar/ics';
import { perguntasFrequentes } from '@/lib/content/site';

const FAQ = perguntasFrequentes(24);

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
    const ld = jsonLdFaq(24);
    expect(ld.mainEntity).toHaveLength(FAQ.length);
    expect(ld.mainEntity[0]?.acceptedAnswer.text).toBe(FAQ[0].resposta);
  });
});

describe('quando o endereço do consultório for definido (FASE-11 §2)', () => {
  const editavel = PROFISSIONAL as unknown as { endereco: Endereco | null };
  afterEach(() => { editavel.endereco = null; });

  it('um objeto em lib/config.ts ativa JSON-LD completo, local da consulta e .ics de uma vez', () => {
    editavel.endereco = {
      logradouro: 'Rua Exemplo', numero: '100', complemento: 'sala 12', bairro: 'Centro',
      cep: '07000-000', mapsUrl: 'https://maps.app.goo.gl/exemplo',
    };
    const ld = jsonLdProfissional();
    expect(ld.address).toMatchObject({ streetAddress: 'Rua Exemplo, 100, sala 12', postalCode: '07000-000', addressLocality: 'Guarulhos' });
    expect(JSON.stringify(ld)).not.toMatch(/undefined|null/);
    expect(localConsulta('in_person')).toBe('Rua Exemplo, 100, sala 12 — Centro, Guarulhos – SP');
    expect(localConsulta('telehealth')).not.toContain('Rua Exemplo');
    const ics = gerarIcs({
      uid: 'u@x', sequence: 0, inicio: new Date('2026-10-01T12:00:00Z'), fim: new Date('2026-10-01T12:40:00Z'),
      tipoLabel: 'Consulta', modalidade: 'in_person', pacienteNome: 'Ana', pacienteEmail: 'a@b.co', organizadorEmail: 'o@b.co',
    }, 'REQUEST');
    expect(ics.replace(/\r\n /g, '')).toContain('LOCATION:Rua Exemplo\\, 100\\, sala 12 — Centro\\, Guarulhos – SP');
  });
});
