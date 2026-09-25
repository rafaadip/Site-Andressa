import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _limparCacheEnv } from '@/lib/env';
import { criarSessao, lerSessao, DURACAO_SESSAO_S, nomeCookieSessao } from '@/lib/auth/sessao';
import { conferirEstado } from '@/lib/auth/oauth';
import { montarCsp } from '@/lib/csp';
import { autorizadoCron } from '@/lib/api/cron';
import { cifrar, decifrar } from '@/lib/crypto';
import { limparPii, mascararTexto } from '@/lib/pii';

const SEGREDO = 'segredo-de-sessao-de-teste-com-32-caracteres-ou-mais';

describe('sessão do painel', () => {
  beforeEach(() => { vi.stubEnv('AUTH_SECRET', SEGREDO); vi.stubEnv('ADMIN_EMAIL', 'Dra@Exemplo.com'); _limparCacheEnv(); });
  afterEach(() => { vi.unstubAllEnvs(); _limparCacheEnv(); });

  it('aceita a sessão assinada da conta autorizada (e-mail sem diferenciar maiúsculas)', () => {
    expect(lerSessao(criarSessao('dra@exemplo.com'))).toMatchObject({ email: 'dra@exemplo.com' });
  });

  it('recusa assinatura adulterada, payload trocado e segredo diferente', () => {
    const v = criarSessao('dra@exemplo.com');
    const [dados, assin] = v.split('.');
    expect(lerSessao(`${dados}.${assin!.slice(0, -2)}xx`)).toBeNull();
    const outro = Buffer.from(JSON.stringify({ email: 'dra@exemplo.com', iat: 0, exp: 9e9 })).toString('base64url');
    expect(lerSessao(`${outro}.${assin}`)).toBeNull();
    expect(lerSessao(criarSessao('dra@exemplo.com', Date.now(), 'outro-segredo-com-mais-de-32-caracteres!!'))).toBeNull();
    expect(lerSessao('lixo')).toBeNull();
    expect(lerSessao(undefined)).toBeNull();
  });

  it('expira em 30 dias', () => {
    const v = criarSessao('dra@exemplo.com', Date.now());
    expect(lerSessao(v, Date.now() + (DURACAO_SESSAO_S - 60) * 1000)).not.toBeNull();
    expect(lerSessao(v, Date.now() + (DURACAO_SESSAO_S + 60) * 1000)).toBeNull();
  });

  it('trocar o ADMIN_EMAIL derruba sessões antigas, mesmo válidas', () => {
    const v = criarSessao('dra@exemplo.com');
    vi.stubEnv('ADMIN_EMAIL', 'nova@exemplo.com'); _limparCacheEnv();
    expect(lerSessao(v)).toBeNull();
  });

  it('sem AUTH_SECRET o painel fica fechado — nunca aberto', () => {
    const v = criarSessao('dra@exemplo.com');
    vi.stubEnv('AUTH_SECRET', ''); _limparCacheEnv();
    expect(lerSessao(v)).toBeNull();
  });

  it('cookie `__Host-` só com HTTPS', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://draandressacorreia.com.br');
    expect(nomeCookieSessao()).toBe('__Host-admin');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    expect(nomeCookieSessao()).toBe('admin_sessao');
  });
});

describe('estado do OAuth (CSRF)', () => {
  it('confere propósito e state em tempo constante', () => {
    expect(conferirEstado('login.abc123', 'abc123')).toBe('login');
    expect(conferirEstado('agenda.abc123', 'abc123')).toBe('agenda');
    expect(conferirEstado('agenda.abc123', 'abc124')).toBeNull();
    expect(conferirEstado('admin.abc123', 'abc123')).toBeNull();
    expect(conferirEstado(undefined, 'abc')).toBeNull();
    expect(conferirEstado('login.abc', null)).toBeNull();
  });
});

describe('CSP', () => {
  it('script só com nonce (sem unsafe-inline), sem frame, sem base externa', () => {
    const csp = montarCsp('NONCE123', { https: true });
    expect(csp).toMatch(/script-src 'self' 'nonce-NONCE123' 'strict-dynamic'(;|$)/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });
  it('em http (localhost) não força https; em dev permite eval do React', () => {
    const csp = montarCsp('n', { dev: true });
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(csp).toContain("'unsafe-eval'");
  });
  it('analytics só entra na CSP quando configurado', () => {
    expect(montarCsp('n')).not.toContain('plausible');
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'draandressacorreia.com.br');
    expect(montarCsp('n')).toContain('connect-src \'self\' https://plausible.io');
    vi.unstubAllEnvs();
  });
});

describe('rotas de cron', () => {
  afterEach(() => vi.unstubAllEnvs());
  const req = (auth?: string) => new Request('http://x/api/cron/a', { headers: auth ? { authorization: auth } : {} });

  it('exigem o Bearer exato', () => {
    vi.stubEnv('CRON_SECRET', 'segredo-do-cron-16+');
    expect(autorizadoCron(req('Bearer segredo-do-cron-16+'))).toBe(true);
    expect(autorizadoCron(req('Bearer segredo-do-cron-16'))).toBe(false);
    expect(autorizadoCron(req())).toBe(false);
  });
  it('sem CRON_SECRET configurado, ficam FECHADAS', () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(autorizadoCron(req('Bearer '))).toBe(false);
  });
});

describe('AES-256-GCM', () => {
  const k = Buffer.alloc(32, 3);
  it('ida e volta; IV novo a cada cifragem', () => {
    const a = cifrar('1//refresh-token', k);
    expect(decifrar(a, k)).toBe('1//refresh-token');
    expect(cifrar('1//refresh-token', k)).not.toBe(a);
  });
  it('blob adulterado ou chave errada LANÇA (não vira lixo silencioso)', () => {
    const a = Buffer.from(cifrar('segredo', k), 'base64');
    a[a.length - 1] = a[a.length - 1]! ^ 1;
    expect(() => decifrar(a.toString('base64'), k)).toThrow();
    expect(() => decifrar(cifrar('segredo', k), Buffer.alloc(32, 4))).toThrow();
  });
});

describe('remoção de dado pessoal (log/Sentry)', () => {
  it('mascara e-mail, telefone e token no texto; preserva datas e UUIDs', () => {
    const t = mascararTexto('ana.souza@gmail.com ligou de +5511912345678 e (11) 91234-5678, link /consulta/Qj6KDA2PGQblJm9ihogwaXrEpW-4rEgEnotYZwLyHc4 em 2026-09-25 id 00000000-0000-4000-8000-000000000001');
    expect(t).not.toMatch(/ana\.souza|912345678|91234-5678|Qj6KDA/);
    expect(t).toContain('2026-09-25');
    expect(t).toContain('00000000-0000-4000-8000-000000000001');
  });
  it('descarta chaves sensíveis pelo nome, em qualquer profundidade', () => {
    const r = limparPii({ agendamento: 'id-1', paciente: { nome: 'Ana' }, patient_note: 'dor', dados: { email: 'a@b.co', ok: 1 } }) as Record<string, unknown>;
    expect(r).toEqual({ agendamento: 'id-1', paciente: '[removido]', patient_note: '[removido]', dados: { email: '[removido]', ok: 1 } });
  });
});

describe('IP do cliente (limite por hora e prova de consentimento)', () => {
  it('usa o primeiro x-forwarded-for (a Vercel sobrescreve o cabeçalho), depois x-real-ip', async () => {
    const { ipDaRequisicao } = await import('@/lib/seguranca');
    expect(ipDaRequisicao(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
    expect(ipDaRequisicao(new Headers({ 'x-real-ip': ' 198.51.100.7 ' }))).toBe('198.51.100.7');
    expect(ipDaRequisicao(new Headers())).toBe('0.0.0.0');
  });
});
