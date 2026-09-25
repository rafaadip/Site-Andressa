/**
 * Dados iniciais: profissional, modalidades e (só em dev/teste) horários.
 *
 * ⚠️ Os horários abaixo são FICTÍCIOS. Em produção os horários reais vêm do
 * painel (/admin/disponibilidade) — e este script NÃO toca neles: apagar e
 * recriar a semana padrão depois de a médica configurá-la seria perder o
 * trabalho dela. Em produção ele só garante profissional e modalidades.
 *
 * Idempotente: pode rodar quantas vezes quiser.
 */
import postgres from 'postgres';
import { PROFISSIONAL } from '../lib/config';
import { bancoLocal } from '../lib/db/tls';

export const PRACTITIONER_ID = '00000000-0000-4000-8000-000000000001';

export const TIPOS = [
  { id: '00000000-0000-4000-8000-000000000011', slug: 'consulta-presencial', label: 'Consulta presencial', duracao: 40, depois: 10, modalidade: 'in_person' },
  { id: '00000000-0000-4000-8000-000000000012', slug: 'teleconsulta', label: 'Teleconsulta', duracao: 30, depois: 10, modalidade: 'telehealth' },
] as const;

/** FICTÍCIO: seg–sex 09–12 e 14–18 presencial; ter e qui 18:30–20:30 teleconsulta. */
const REGRAS = [
  ...[1, 2, 3, 4, 5].flatMap((d) => [
    { dia: d, de: '09:00', ate: '12:00', modalidade: 'in_person' },
    { dia: d, de: '14:00', ate: '18:00', modalidade: 'in_person' },
  ]),
  { dia: 2, de: '18:30', ate: '20:30', modalidade: 'telehealth' },
  { dia: 4, de: '18:30', ate: '20:30', modalidade: 'telehealth' },
];

export async function semear(url: string, opcoes: { horariosFicticios?: boolean } = {}) {
  const comHorarios = opcoes.horariosFicticios ?? true;
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO practitioner (id, full_name, crm, timezone)
        VALUES (${PRACTITIONER_ID}, ${PROFISSIONAL.nome}, ${PROFISSIONAL.crm}, ${PROFISSIONAL.timezone})
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, crm = EXCLUDED.crm`;

      for (const t of TIPOS) {
        if (!comHorarios) {
          // Produção: só cria o que falta — nome, duração e intervalos são
          // editados no painel e não podem ser sobrescritos por um re-seed.
          await tx`
            INSERT INTO appointment_type (id, practitioner_id, slug, label, duration_min, buffer_before_min, buffer_after_min, location_kind)
            VALUES (${t.id}, ${PRACTITIONER_ID}, ${t.slug}, ${t.label}, ${t.duracao}, 0, ${t.depois}, ${t.modalidade})
            ON CONFLICT (practitioner_id, slug) DO NOTHING`;
          continue;
        }
        await tx`
          INSERT INTO appointment_type (id, practitioner_id, slug, label, duration_min, buffer_before_min, buffer_after_min, location_kind)
          VALUES (${t.id}, ${PRACTITIONER_ID}, ${t.slug}, ${t.label}, ${t.duracao}, 0, ${t.depois}, ${t.modalidade})
          ON CONFLICT (practitioner_id, slug) DO UPDATE SET
            label = EXCLUDED.label, duration_min = EXCLUDED.duration_min,
            buffer_after_min = EXCLUDED.buffer_after_min, is_active = true`;
      }

      if (!comHorarios) return;
      await tx`DELETE FROM availability_rule WHERE practitioner_id = ${PRACTITIONER_ID}`;
      for (const r of REGRAS) {
        await tx`
          INSERT INTO availability_rule (practitioner_id, weekday, start_time, end_time, location_kind)
          VALUES (${PRACTITIONER_ID}, ${r.dia}, ${r.de}, ${r.ate}, ${r.modalidade})`;
      }
    });
  } finally {
    await sql.end();
  }
}

/**
 * Horários fictícios só num banco LOCAL (ou com confirmação explícita).
 * Decidir por NODE_ENV não bastava: um `DATABASE_URL=<produção> npm run
 * db:seed` esquecido apagava a semana real da médica (SEC-13).
 */
export function semearHorariosFicticios(url: string, env: Partial<Record<string, string>> = process.env): boolean {
  if (env.SEED_CONFIRMO_FICTICIO === 'sim') return true;
  return env.NODE_ENV !== 'production' && bancoLocal(url);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL.');
  const ficticios = semearHorariosFicticios(url);
  await semear(url, { horariosFicticios: ficticios });
  console.log(ficticios
    ? '\n  ✓ Seed aplicado (horários FICTÍCIOS de desenvolvimento).\n'
    : '\n  ✓ Profissional e modalidades garantidos. Horários: configure em /admin/disponibilidade.\n');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
