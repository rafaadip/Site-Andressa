# ADR-002 — Google Calendar como fonte da verdade da agenda

- **Status:** Aceita
- **Data:** 2026-09-10

## Contexto

A médica atende em plantões (UPA Taboão, Hapvida, CHPBG) com escala variável. A
agenda pessoal dela muda **fora** do nosso sistema — no celular, entre um
atendimento e outro. Se o site ofertar um horário em que ela está de plantão, o
paciente aparece e não há médica: o pior defeito possível neste produto.

Portanto o sistema precisa de uma **fonte de verdade sobre "ela está livre?"**, e
essa fonte tem que ser aquela que ela realmente usa no dia a dia.

## Opções

### A. Nosso banco é a fonte da verdade

Ela cadastraria bloqueios no `/admin`.

- ➖ Depende de disciplina humana durante o plantão. Vai falhar.

### B. Google Calendar é a fonte da verdade

- ➕ Ela já usa (conta Gmail confirmada no currículo).
- ➕ API v3 madura: `freebusy.query`, `events.insert`, sincronização incremental via
  `syncToken` e **push notifications** por webhook.
- ➕ O OAuth é feito **uma vez**, no `/admin`, com `access_type=offline`.
- ➖ Dependência externa: se a API cair, não conseguimos ler disponibilidade.
- ➖ Refresh token é credencial de alto valor e precisa ser cifrado.

### C. CalDAV no iCloud como fonte da verdade

- ➕ Padrão aberto, sem OAuth.
- ➖ Autenticação por **senha de app**, que quebra silenciosamente quando ela troca a
  senha do Apple ID.
- ➖ Sem push confiável; exigiria polling.
- ➖ Implementações do iCloud têm particularidades mal documentadas.

## Decisão

**Opção B.** Google Calendar é a fonte da verdade para *free/busy* e o destino
primário dos eventos criados. O iCloud é destino **secundário e opcional**
(ADR-003).

### Degradação quando o Google está indisponível

Não podemos deixar o site "quebrar" junto com a API:

| Situação | Comportamento |
|---|---|
| FreeBusy falha ao listar slots | Serve o último resultado em cache (TTL estendido para 15 min) + aviso discreto: *"confirmaremos seu horário por WhatsApp"* |
| Cache também vazio | Oferta slots só a partir de **D+2** e marca `sync_state='pending'` — a médica confirma manualmente |
| `events.insert` falha na confirmação | Agendamento **é mantido**; job de reconciliação tenta de novo com backoff (5 tentativas / 24 h); alerta ao admin |

O princípio: **nunca perder o agendamento por falha de integração.** Um evento
faltando na agenda é recuperável; um paciente que desistiu, não.

## Consequências

- `calendar_connection` guarda `refresh_token_enc` (AES-256-GCM), `sync_token` e
  `channel_id`.
- Escopos mínimos: `calendar.events` (escrita nos nossos eventos) +
  `calendar.readonly` (FreeBusy). **Não** pedimos `calendar` amplo.
- É preciso publicar a tela de consentimento OAuth no Google Cloud Console. Como
  usa escopo sensível, o app fica em modo **Testing** com a conta dela como *test
  user* — evita o processo de verificação, que não faz sentido para um app de
  usuário único. Documentar isso em FASE-05.
- Renovação de canal push é um cron diário; sem ele, o webhook morre em ~30 dias.
