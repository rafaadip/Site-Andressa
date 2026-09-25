/**
 * Guarda de conformidade — publicidade médica (CFM) e LGPD.
 *
 * A pós-graduação em Nutrologia está EM CURSO até jul/2027. Anunciar
 * especialidade sem RQE registrado no CRM é infração ética passível de
 * processo. Este script impede que o termo reapareça por descuido —
 * numa refatoração, num copy-paste do carrossel, num texto novo.
 *
 * Ver docs/fases/FASE-10-compliance-lgpd-cfm.md
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const DIRS = ['app', 'components', 'lib'];
const ISENTOS = ['lib/config.ts'];      // única fonte autorizada
const EXTENSOES = /\.(ts|tsx|css|md)$/;

type Regra = {
  padrao: RegExp;
  motivo: string;
};

const PROIBIDOS: Regra[] = [
  {
    padrao: /\bespecialista\s+em\s+nutrologia\b/i,
    motivo: 'Exige RQE registrado no CRM. A pós-graduação está em curso.',
  },
  {
    padrao: /\bnutr[óo]loga\b/i,
    motivo: 'Designa especialidade. Use "com atuação em Nutrologia".',
  },
  {
    padrao: /\bRQE\s*\d/i,
    motivo: 'Não há RQE emitido. Preencha PROFISSIONAL.rqe quando houver.',
  },
  {
    padrao: /\b(a\s+melhor|referência\s+em|exclusiv[oa]|únic[oa]\s+n[oa])\b/i,
    motivo: 'Autopromoção comparativa é vedada na publicidade médica.',
  },
  {
    padrao: /\bresultado\s+garantido\b|\bvoc[êe]\s+vai\s+emagrecer\b/i,
    motivo: 'Promessa de resultado é vedada.',
  },
  {
    padrao: /\bR\$\s*\d|\bprimeira\s+consulta\s+gr[áa]tis\b|\bdesconto\b/i,
    motivo: 'Divulgação de preço, desconto ou promoção é vedada.',
  },
  {
    padrao: /\bantes\s+e\s+depois\b/i,
    motivo: 'Imagem comparativa de resultado é vedada.',
  },
];

/** CRM escrito à mão fora do config. */
const CRM_LITERAL = /CRM[- ]?SP\s*\d/i;

function arquivos(dir: string): string[] {
  const alvo = join(RAIZ, dir);
  let entradas: string[];
  try { entradas = readdirSync(alvo); } catch { return []; }

  return entradas.flatMap((e) => {
    const caminho = join(alvo, e);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, e));
    return EXTENSOES.test(e) ? [join(dir, e)] : [];
  });
}

type Achado = { arquivo: string; linha: number; trecho: string; motivo: string };
const achados: Achado[] = [];

for (const dir of DIRS) {
  for (const arquivo of arquivos(dir)) {
    const rel = relative(RAIZ, join(RAIZ, arquivo)).replace(/\\/g, '/');
    const isento = ISENTOS.includes(rel);
    const linhas = readFileSync(join(RAIZ, arquivo), 'utf8').split('\n');

    linhas.forEach((linha, i) => {
      // Comentários que explicam a própria regra não são violação.
      const ehComentario = /^\s*(\/\/|\*|\/\*)/.test(linha);

      // lib/config.ts é a ÚNICA fonte autorizada: contém legitimamente o
      // rótulo com RQE, no ramo que só ativa quando PROFISSIONAL.rqe existe.
      if (isento || ehComentario) return;

      for (const regra of PROIBIDOS) {
        if (regra.padrao.test(linha)) {
          achados.push({ arquivo: rel, linha: i + 1, trecho: linha.trim(), motivo: regra.motivo });
        }
      }
      if (CRM_LITERAL.test(linha)) {
        achados.push({
          arquivo: rel, linha: i + 1, trecho: linha.trim(),
          motivo: 'CRM escrito à mão. Use PROFISSIONAL.crm de lib/config.ts.',
        });
      }
    });
  }
}

if (achados.length > 0) {
  console.error('\n  Conformidade — violações encontradas:\n');
  for (const a of achados) {
    console.error(`  ✗ ${a.arquivo}:${a.linha}`);
    console.error(`    ${a.trecho.slice(0, 90)}`);
    console.error(`    → ${a.motivo}\n`);
  }
  console.error(`  ${achados.length} violação(ões). Ver docs/fases/FASE-10-compliance-lgpd-cfm.md\n`);
  process.exit(1);
}

console.log('\n  Conformidade CFM/LGPD: nenhuma violação.\n');
