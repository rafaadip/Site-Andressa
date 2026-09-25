/**
 * Dados de DESENVOLVIMENTO e TESTE.
 *
 * ⚠️ Os horários abaixo são FICTÍCIOS. Os horários reais da médica ainda
 * não foram informados; em produção eles vêm do painel (FASE-09) ou de um
 * seed próprio aprovado por ela. Rodar isto em produção ofertaria horários
 * inventados — por isso o script exige confirmação fora de dev.
 *
 * Idempotente: pode rodar quantas vezes quiser.
 */
import postgres from 'postgres';
import { PROFISSIONAL } from '../lib/config';

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

export async function semear(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO practitioner (id, full_name, crm, timezone)
        VALUES (${PRACTITIONER_ID}, ${PROFISSIONAL.nome}, ${PROFISSIONAL.crm}, ${PROFISSIONAL.timezone})
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, crm = EXCLUDED.crm`;

      for (const t of TIPOS) {
        await tx`
          INSERT INTO appointment_type (id, practitioner_id, slug, label, duration_min, buffer_before_min, buffer_after_min, location_kind)
          VALUES (${t.id}, ${PRACTITIONER_ID}, ${t.slug}, ${t.label}, ${t.duracao}, 0, ${t.depois}, ${t.modalidade})
          ON CONFLICT (practitioner_id, slug) DO UPDATE SET
            label = EXCLUDED.label, duration_min = EXCLUDED.duration_min,
            buffer_after_min = EXCLUDED.buffer_after_min, is_active = true`;
      }

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

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL.');
  if (process.env.NODE_ENV === 'production' && process.env.SEED_CONFIRMO_FICTICIO !== 'sim') {
    throw new Error('Seed com horários FICTÍCIOS em produção. Defina SEED_CONFIRMO_FICTICIO=sim se é mesmo isso.');
  }
  await semear(url);
  console.log('\n  ✓ Seed aplicado (horários FICTÍCIOS de desenvolvimento).\n');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
