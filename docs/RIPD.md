# RIPD — Relatório de Impacto à Proteção de Dados Pessoais

> Agendamento online do site da Dra. Andressa Chaves Correia.
> Base: LGPD (Lei 13.709/2018), art. 5º XVII e art. 38. Documento vivo:
> revisar a cada mudança no tratamento e, no mínimo, uma vez por ano
> ([FASE-14 §6](fases/FASE-14-roadmap.md)).
>
> ⚠️ Orientação de engenharia, **não** parecer jurídico. Precisa de revisão e
> assinatura da controladora antes do go-live ([FASE-13 §7](fases/FASE-13-deploy-observabilidade.md)).

| | |
|---|---|
| Controladora | Dra. Andressa Chaves Correia (dados de identificação em `lib/config.ts`) |
| Encarregada (DPO) | A própria controladora — canal: e-mail da política de privacidade |
| Versão | 1.0 — 25/09/2026 |
| Sistema | Site institucional + agendamento + painel (`/admin`) |

---

## 1. Por que este relatório existe

O motivo da consulta, quando o paciente o escreve, é **dado pessoal sensível
referente à saúde** (art. 5º, II). Tratamento de dado sensível justifica a
avaliação de impacto — e o sistema foi desenhado para que esse dado seja
**opcional, consentido à parte, visível só atrás de login e apagado em 90 dias**.

**O sistema não é prontuário.** Não há evolução clínica, exame, diagnóstico nem
prescrição ([00-ARQUITETURA §2.3](00-ARQUITETURA.md)).

## 2. Descrição do tratamento

| Etapa | O que acontece | Onde |
|---|---|---|
| Coleta | Paciente preenche nome, telefone, e-mail e, opcionalmente, o motivo | `/agendar` |
| Uso | Marcar a consulta, confirmar, lembrar, avisar mudanças | Servidor (Vercel) |
| Compartilhamento | Evento na agenda Google da médica; e-mails via Resend | Operadores (§5) |
| Acesso | Médica, no painel com login Google restrito a uma conta | `/admin` |
| Retenção | Motivo: 90 dias após a consulta · contato: 5 anos | Cron diário |
| Eliminação | A pedido (painel → Privacidade) ou pela retenção automática | Anonimização |

## 3. Inventário de dados

| Dado | Categoria | Finalidade | Base legal | Retenção |
|---|---|---|---|---|
| Nome, e-mail, telefone | Pessoal | Agendar, confirmar, lembrar | Execução de contrato / procedimentos preliminares (art. 7º, V) | 5 anos |
| Data, hora e modalidade | Pessoal | Organizar a agenda | Idem | 5 anos |
| **Motivo da consulta** | **Sensível (saúde)** | Preparo da médica | **Consentimento específico e destacado (art. 11, I)** | **90 dias** após a consulta, ou na hora, se revogado — no banco **e** no evento da agenda Google |
| Recado da médica ao cancelar (texto livre) | Pessoal (pode citar saúde) | Explicar o cancelamento ao paciente | Execução de contrato (art. 7º, V) | 90 dias após a consulta; sai na eliminação |
| Registro do consentimento (data/hora, versão do texto) | Pessoal | Provar o consentimento | Obrigação legal / exercício de direitos (art. 7º, II e VI) | 5 anos |
| Hash de IP (SHA-256 com sal) | Pessoal pseudonimizado | Prova do consentimento e limite anti-abuso | Legítimo interesse (art. 7º, IX) | 5 anos |
| Trilha de auditoria (ação, data, ids) | Pessoal (indireto) | Prestação de contas (art. 37) | Obrigação legal | 5 anos |

**Não coletamos**: CPF, data de nascimento, endereço, convênio, peso, altura,
foto, exames. Cada campo passou pelo teste "o agendamento funciona sem isso?".

## 4. Necessidade e proporcionalidade

- **Minimização**: três campos obrigatórios; o motivo é opcional.
- **Consentimento destacado**: dois checkboxes, ambos desmarcados; o de saúde só
  aparece se houver motivo escrito (art. 8º; silêncio não é consentimento).
- **Versão do texto aceito** gravada em cada consulta (`consent_version`).
- **Motivo nunca** em `localStorage`, log, Sentry, auditoria ou e-mail — o e-mail
  à médica diz apenas "veja no painel".
- **Evento na agenda Google**: por padrão **não** inclui o motivo — traz só
  "ver no painel". A médica pode ligar em `/admin/configuracoes` (é a
  controladora e pode precisar dele para se preparar). O evento **espelha a
  consulta**: motivo revogado ou vencido (90 dias) e titular eliminado saem
  também do evento, inclusive de consulta passada (SEC-06, `docs/SEGURANCA.md`).
  Texto do paciente vai sem `<`/`>` (o Calendar renderiza HTML).
- **Nome** só com letras (acento, apóstrofo, hífen): o nome sai em e-mail e na
  agenda da médica, e não pode carregar link de golpe.
- **Sem cookie** para o paciente; analytics, se usado, é sem cookie (ADR-005).

## 5. Operadores e transferência internacional

| Operador | Papel | Dados | Local |
|---|---|---|---|
| Supabase | Banco de dados | Todos os do §3 | `sa-east-1` (São Paulo) |
| Vercel | Hospedagem e execução | Trânsito de todos | Global (pode ser fora do Brasil) |
| Google | Agenda da médica | Nome, contato, horário, motivo (se ligado) | Global |
| Resend | Envio de e-mail | Nome, e-mail, horário | EUA |
| Sentry *(opcional)* | Erros técnicos | Nenhum dado pessoal (filtrado antes do envio) | EUA/UE |
| Plausible *(opcional)* | Estatística de visita | Nenhum dado pessoal | UE |

Transferência internacional amparada nas cláusulas contratuais dos operadores
(art. 33). A política de privacidade nomeia todos e cita a transferência.

## 6. Riscos e medidas

| # | Risco | Prob. | Impacto | Medidas implementadas | Onde |
|---|---|---|---|---|---|
| R1 | Vazamento do banco expõe links de gestão | Baixa | Alto | Só o **hash** do token no banco; token de 256 bits derivado por HMAC com sal fora do banco | `lib/seguranca.ts` |
| R2 | Vazamento do refresh token do Google | Baixa | Alto | AES-256-GCM em repouso, chave em variável de ambiente; escopos mínimos (2) | `lib/crypto.ts` |
| R3 | Acesso indevido ao painel | Baixa | Alto | Login Google + allowlist de UMA conta; sessão HMAC; dupla checagem (proxy + página/ação, com a sessão conferida no banco); "Sair" revoga a sessão em todo aparelho; CSRF por Origem nas Server Actions | `proxy.ts`, `lib/auth` |
| R4 | Dado de saúde em log/monitoramento | Média | Alto | Filtro de PII por chave e por padrão (e-mail, telefone, token) em todo log; ao Sentry, erro de banco vai só como SQLSTATE (os params da query nunca saem) | `lib/pii.ts`, `lib/observabilidade.ts` |
| R5 | Enumeração de consultas pela URL | Baixa | Médio | Token opaco; `/consulta/*` com `noindex`, `no-store` e `Referrer-Policy: no-referrer` | `app/(site)/consulta` |
| R6 | XSS roubando dados da página | Baixa | Alto | CSP estrita com nonce por requisição, sem script de terceiro | `lib/csp.ts` |
| R7 | Retenção além do necessário | Média | Médio | Cron de retenção diário com trilha das exclusões | `lib/lgpd/retencao.ts` |
| R8 | E-mail enviado a endereço errado | Média | Baixo | Sugestão de correção de domínio; bounce marca o cadastro e para os envios | `lib/email/webhook.ts` |
| R9 | Ambiente de teste tocar a agenda real | Baixa | Alto | Guarda que recusa a agenda real fora da produção | `lib/calendar/conexao.ts` |
| R10 | Exportação CSV com fórmula maliciosa | Baixa | Baixo | Neutralização de `= + - @` | `lib/agendamento/admin.ts` |
| R11 | Interceptação entre a função e o banco | Baixa | Alto | TLS obrigatório com host remoto; certificado verificado com `DATABASE_CA_CERT` | `lib/db/tls.ts` |
| R12 | Abuso do agendamento anônimo (agenda esgotada, e-mail a terceiros) | Média | Médio | Limites por IP (/64 no IPv6), por e-mail canônico e global, contados sob lock; honeypot; WAF recomendado. Double opt-in em avaliação | `lib/agendamento/servico.ts`, `docs/SEGURANCA.md` |

**Risco residual aceito**: se a médica ligar o motivo no evento, cópias que o
Google mantenha fora do evento (lixeira, histórico, notificações já enviadas)
seguem a política do Google, não a do sistema. O evento em si é redigido pela
reconciliação (a cada 5 min) na revogação, na retenção e na eliminação. Padrão
desligado; orientação à médica.

## 7. Direitos do titular (art. 18)

| Direito | Como | Prazo |
|---|---|---|
| Confirmação e acesso | Página da consulta (link) ou pedido por e-mail → exportação | 15 dias |
| Correção | Pedido por e-mail/WhatsApp; médica ajusta | 15 dias |
| Eliminação | Painel → Privacidade → Eliminar (anonimiza, cancela futuras sem e-mail, apaga o recado de cancelamento e redige os eventos da agenda Google) | Imediato no banco; evento em até 5 min |
| Portabilidade | Painel → Privacidade → Exportar JSON/CSV | Imediato |
| Revogação do consentimento de saúde | Botão na página da consulta (confirmação em 2 toques) — apaga o motivo na hora, também do evento da agenda | Imediato no banco; evento em até 5 min |

## 8. Incidentes

1. Conter (revogar credencial, girar `AUTH_SECRET`/`TOKEN_SALT`/`ENCRYPTION_KEY`).
2. Avaliar dados e titulares atingidos pela trilha de auditoria.
3. Comunicar à ANPD e aos titulares em prazo razoável (art. 48; Resolução
   CD/ANPD nº 15/2024: 3 dias úteis) quando houver risco relevante.
4. Registrar o incidente e as medidas neste documento.

## 9. Aprovação

| | Nome | Data | Assinatura |
|---|---|---|---|
| Controladora | Dra. Andressa Chaves Correia | | |
| Revisão jurídica | | | |
