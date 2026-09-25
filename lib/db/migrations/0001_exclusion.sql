-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  TRAVA ANTI-OVERBOOKING — NÃO REMOVER                                ║
-- ║                                                                      ║
-- ║  Sem isto, duas requisições simultâneas para o mesmo horário passam  ║
-- ║  ambas pelo SELECT de verificação e ambas inserem. É a race          ║
-- ║  condition clássica de reserva: rara em teste, inevitável em         ║
-- ║  produção quando o link é postado no Instagram.                      ║
-- ║                                                                      ║
-- ║  Um lock em processo Node NÃO resolve: o deploy é serverless, com    ║
-- ║  várias instâncias e nenhuma memória compartilhada. Só o banco pode  ║
-- ║  garantir a invariante.                                              ║
-- ║                                                                      ║
-- ║  `&&` é sobreposição, não igualdade: uma consulta de 40min às 14:00  ║
-- ║  bloqueia a de 30min às 14:20. UNIQUE(starts_at) não faria isso.     ║
-- ║                                                                      ║
-- ║  O WHERE é essencial: agendamentos cancelados PRECISAM poder         ║
-- ║  sobrepor, senão um cancelamento bloquearia o horário para sempre.   ║
-- ║                                                                      ║
-- ║  docs/adr/ADR-004-antioverbooking.md                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_no_overlap"
  EXCLUDE USING gist (
    "practitioner_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  ) WHERE (status IN ('held', 'confirmed'));
