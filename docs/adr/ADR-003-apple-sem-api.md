# ADR-003 — Apple Calendar via `.ics` e CalDAV, sem API

- **Status:** Aceita
- **Data:** 2026-09-10

## Contexto

O objetivo do projeto pede "agendamento conectado ao Google Agenda / Apple
Calendar". Há uma assimetria factual entre os dois:

**A Apple não publica uma API REST de calendário.** Não existe equivalente ao
Google Calendar API. EventKit é framework **local**, para apps nativos iOS/macOS —
inútil a partir de um servidor web. "Sign in with Apple" autentica identidade, e
não dá acesso a calendário.

O que existe:

1. **CalDAV** (RFC 4791) — o iCloud expõe `caldav.icloud.com`, autenticado por
   **senha de app**, não OAuth.
2. **iCalendar / `.ics`** (RFC 5545) — formato de arquivo que o Apple Calendar
   importa nativamente.

## Decisão

Separar os dois problemas (ver [00-ARQUITETURA §3](../00-ARQUITETURA.md#3-a-decisão-central-o-que-sincronizar-com-google-e-apple-realmente-significa)):

### Paciente → `.ics`, sempre

Entregue por dois caminhos:

1. **Anexo do e-mail** com `Content-Type: text/calendar; method=REQUEST; charset=UTF-8`.
   No iOS Mail isso vira um cartão de evento com botão "Adicionar" — sem download,
   sem app extra. É a melhor experiência disponível em iPhone, e não requer API
   nenhuma.
2. **Botão de download** na tela de sucesso, para quem quiser o arquivo na hora.

Complementado por um link `calendar.google.com/calendar/render?action=TEMPLATE&...`
para quem usa Google no navegador.

Isso cobre Apple Calendar, Google, Outlook, Samsung Calendar e Thunderbird com
**um único artefato padronizado**. Zero autenticação do paciente.

### Médica → CalDAV opcional, ou feed `webcal://`

Duas rotas, escolhidas pela preferência dela:

| Rota | Como funciona | Prós | Contras |
|---|---|---|---|
| **B1 — Feed `webcal://` (recomendado)** | Publicamos `/api/calendario/<token>.ics` com todos os agendamentos. Ela assina uma vez em *Ajustes → Calendário → Contas → Adicionar Calendário Assinado*. | Sem credencial da Apple no nosso servidor; nunca quebra; funciona em qualquer cliente | Somente leitura; iOS atualiza a cada ~15 min–1 h |
| **B2 — CalDAV com senha de app** | Escrevemos os eventos direto no iCloud via `PUT` CalDAV. | Evento aparece como nativo, editável | Guardamos credencial da Apple; quebra em silêncio se ela trocar a senha; sem push |

**Padrão: B1.** B2 fica atrás de uma flag e só é implementado se ela pedir
explicitamente (FASE-06, marcada como opcional).

## Consequências

- O gerador de `.ics` é **componente de primeira classe**, com testes contra o
  RFC 5545 — não um utilitário improvisado. Requisitos:
  - `UID` estável por agendamento (`ics_uid`), para que cancelamento/remarcação
    **atualizem** o evento em vez de criar duplicata;
  - `SEQUENCE` incrementado a cada alteração — sem isso, os clientes ignoram updates;
  - `METHOD:REQUEST` para criar/atualizar, `METHOD:CANCEL` para cancelar;
  - `VTIMEZONE` embutido com `TZID=America/Sao_Paulo` (§7 da arquitetura);
  - quebra de linha CRLF e *folding* em 75 octetos — Apple Calendar é rigoroso;
  - escape de `,` `;` `\` e `\n` no `DESCRIPTION`.
- O token do feed `webcal://` é uma **URL-capability**: quem tem o link vê a agenda.
  32 bytes aleatórios, revogável no `/admin`, `X-Robots-Tag: noindex`.
- A comunicação com a médica deve deixar claro o que "conectado ao Apple Calendar"
  significa aqui, para não gerar expectativa de sincronização bidirecional
  instantânea.

## Nota sobre o protótipo

O `index.html` já gera `.ics` no cliente — a intuição estava certa. Os defeitos a
corrigir na migração:

```js
// ❌ offset fixo: quebra se o horário de verão voltar
const utc = dt => new Date(dt.getTime() + 3*3600000);
// ❌ UID baseado em Date.now(): muda a cada geração,
//    então cancelar cria um evento novo em vez de remover o antigo
`UID:${Date.now()}@draandressacorreia`
// ❌ sem SEQUENCE: clientes descartam qualquer atualização
```
