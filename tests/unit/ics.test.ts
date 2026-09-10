import { describe, it, expect } from 'vitest';
import ICAL from 'ical.js';
import { gerarIcs, dobrar, escapar, linkGoogleCalendar, type DadosIcs } from '@/lib/calendar/ics';

const BASE: DadosIcs = {
  uid: 'abc-123@draandressacorreia.com.br',
  sequence: 0,
  inicio: new Date('2026-09-15T17:00:00Z'), // 14:00 em Brasília
  fim: new Date('2026-09-15T17:40:00Z'),
  tipoLabel: 'Consulta em Nutrologia',
  modalidade: 'in_person',
  pacienteNome: 'Ana Souza',
  pacienteEmail: 'ana@exemplo.com',
  organizadorEmail: 'contato@draandressacorreia.com.br',
  urlGestao: 'https://draandressacorreia.com.br/consulta/tok123',
};

const linhas = (ics: string) => ics.split('\r\n');

/** RFC 5545 §3.1 — desdobra continuações (linha seguinte iniciada por espaço). */
const desdobrar = (ics: string) => ics.replace(/\r\n /g, '');

/** Busca um campo DENTRO do VEVENT — o VTIMEZONE também tem DTSTART. */
const campo = (ics: string, nome: string) => {
  const corpo = desdobrar(ics).split('BEGIN:VEVENT')[1] ?? '';
  return corpo.split('\r\n')
    .find((l) => l.startsWith(nome + ':') || l.startsWith(nome + ';'));
};

describe('validade contra biblioteca independente', () => {
  it('ical.js parseia sem erro', () => {
    expect(() => ICAL.parse(gerarIcs(BASE, 'REQUEST'))).not.toThrow();
  });

  it('o evento tem os campos essenciais e a hora certa', () => {
    const comp = new ICAL.Component(ICAL.parse(gerarIcs(BASE, 'REQUEST')));
    const ev = new ICAL.Event(comp.getFirstSubcomponent('vevent')!);
    expect(ev.uid).toBe(BASE.uid);
    expect(ev.summary).toContain('Consulta em Nutrologia');
    expect(ev.startDate.toJSDate().toISOString()).toBe('2026-09-15T17:00:00.000Z');
  });
});

describe('estrutura do RFC 5545', () => {
  const ics = gerarIcs(BASE, 'REQUEST');

  it('usa CRLF, não LF sozinho', () => {
    expect(ics).toContain('\r\n');
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('embute VTIMEZONE e usa TZID em vez de UTC convertido', () => {
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics).toContain('TZID:America/Sao_Paulo');
    expect(campo(ics, 'DTSTART')).toBe('DTSTART;TZID=America/Sao_Paulo:20260915T140000');
  });

  it('METHOD coerente com o status', () => {
    expect(gerarIcs(BASE, 'REQUEST')).toContain('METHOD:REQUEST');
    expect(gerarIcs(BASE, 'REQUEST')).toContain('STATUS:CONFIRMED');
    expect(gerarIcs(BASE, 'CANCEL')).toContain('METHOD:CANCEL');
    expect(gerarIcs(BASE, 'CANCEL')).toContain('STATUS:CANCELLED');
  });

  it('inclui alarme só no REQUEST', () => {
    expect(gerarIcs(BASE, 'REQUEST')).toContain('BEGIN:VALARM');
    expect(gerarIcs(BASE, 'CANCEL')).not.toContain('BEGIN:VALARM');
  });
});

describe('cancelamento — o teste que prova que o evento SOME do iPhone', () => {
  it('mantém o mesmo UID e incrementa SEQUENCE', () => {
    const criado = gerarIcs(BASE, 'REQUEST');
    const cancelado = gerarIcs({ ...BASE, sequence: 1 }, 'CANCEL');
    expect(campo(criado, 'UID')).toBe(campo(cancelado, 'UID'));
    expect(campo(criado, 'SEQUENCE')).toBe('SEQUENCE:0');
    expect(campo(cancelado, 'SEQUENCE')).toBe('SEQUENCE:1');
  });

  it('UID nunca depende do relógio', () => {
    // Regressão do protótipo: `UID:${Date.now()}` fazia cancelar CRIAR evento.
    expect(gerarIcs(BASE, 'REQUEST')).toContain(`UID:${BASE.uid}`);
    expect(gerarIcs(BASE, 'REQUEST')).toContain(`UID:${BASE.uid}`);
  });
});

describe('escape (§3.3.11)', () => {
  it('escapa vírgula, ponto-e-vírgula, barra e quebra de linha', () => {
    expect(escapar('a,b')).toBe('a\\,b');
    expect(escapar('a;b')).toBe('a\\;b');
    expect(escapar('a\\b')).toBe('a\\\\b');
    expect(escapar('a\nb')).toBe('a\\nb');
  });

  it('escapa a barra invertida ANTES dos demais (ordem importa)', () => {
    expect(escapar('a\\,b')).toBe('a\\\\\\,b');
  });

  it('descrição com pontuação sobrevive ao round-trip', () => {
    const ics = gerarIcs({ ...BASE, pacienteNome: 'Ana, Maria; Silva' }, 'REQUEST');
    const comp = new ICAL.Component(ICAL.parse(ics));
    const ev = new ICAL.Event(comp.getFirstSubcomponent('vevent')!);
    expect(ev.description).toContain('Ana, Maria; Silva');
  });
});

describe('folding (§3.1)', () => {
  it('nenhuma linha passa de 75 octetos', () => {
    const ics = gerarIcs({ ...BASE, pacienteNome: 'José Antônio Gonçalves '.repeat(6) }, 'REQUEST');
    for (const l of linhas(ics)) {
      expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
    }
  });

  it('não corta caractere multibyte ao meio', () => {
    const nome = 'ãçõéêÁÂÃ'.repeat(20);
    const ics = gerarIcs({ ...BASE, pacienteNome: nome }, 'REQUEST');
    expect(ics).not.toContain('�'); // caractere de substituição
    const comp = new ICAL.Component(ICAL.parse(ics));
    const ev = new ICAL.Event(comp.getFirstSubcomponent('vevent')!);
    expect(ev.description).toContain(nome);
  });

  it('linhas dobradas continuam com espaço', () => {
    const d = dobrar('X'.repeat(200));
    for (const [i, l] of d.split('\r\n').entries()) {
      if (i > 0) expect(l.startsWith(' ')).toBe(true);
    }
  });
});

describe('modo sem endereço', () => {
  it('LOCATION degrada para o texto de confirmação, sem "undefined"', () => {
    const ics = gerarIcs(BASE, 'REQUEST');
    const loc = campo(ics, 'LOCATION')!;
    expect(loc).toContain('Guarulhos');
    expect(loc).toContain('endereço enviado na confirmação');
    expect(ics).not.toContain('undefined');
    expect(ics).not.toContain('null');
  });

  it('teleconsulta usa texto próprio', () => {
    const ics = gerarIcs({ ...BASE, modalidade: 'telehealth' }, 'REQUEST');
    expect(campo(ics, 'LOCATION')).toContain('Teleconsulta');
  });
});

describe('link do Google Calendar', () => {
  it('usa UTC compacto e informa o fuso da clínica', () => {
    const url = new URL(linkGoogleCalendar(BASE));
    expect(url.searchParams.get('dates')).toBe('20260915T170000Z/20260915T174000Z');
    expect(url.searchParams.get('ctz')).toBe('America/Sao_Paulo');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
  });
});
