# ADR-003 — `.ics` universal para o paciente; agenda da médica só no Google

- **Status:** Aceita
- **Data:** 2026-09-10
- **Revisada em:** 2026-09-10 — escopo reduzido a pedido do cliente
- **Substitui:** a versão anterior desta ADR, que previa sincronização da agenda da
  médica com o iCloud (feed `webcal://` ou CalDAV)

## Contexto

O objetivo original pedia "agendamento conectado ao Google Agenda / Apple Calendar".
Há uma assimetria factual entre os dois:

**A Apple não publica uma API REST de calendário.** Não existe equivalente ao Google
Calendar API. EventKit é framework **local**, para apps nativos iOS/macOS — inútil a
partir de um servidor web. "Sign in with Apple" autentica identidade, e não dá acesso
a calendário. As únicas vias são CalDAV (RFC 4791, autenticado por senha de app) e o
formato de arquivo iCalendar (RFC 5545).

O cliente decidiu, depois, **não sincronizar a agenda da médica com a Apple** — só
Google Calendar.

## A distinção que sustenta a decisão

São dois problemas diferentes, e é fácil confundi-los:

| | Agenda da **médica** | Calendário do **paciente** |
|---|---|---|
| Precisa | Ler e escrever, continuamente | Receber o evento, **uma vez** |
| Quem autentica | Ela, uma vez, no `/admin` | **Ninguém** |
| Solução | Google Calendar API v3 | Arquivo `.ics` + link do Google |

**O `.ics` não é "integração com a Apple".** É um formato aberto — RFC 5545 — lido
nativamente por Apple Calendar, Google Agenda, Outlook, Samsung Calendar e
Thunderbird. Um único arquivo resolve o lado do paciente em todas as plataformas de
uma vez, sem API proprietária e sem login.

## Decisão

### 1. Agenda da médica: **exclusivamente Google Calendar**

Removidos do escopo:
- ❌ Feed `webcal://` assinado (`/api/calendario/<token>.ics`)
- ❌ CalDAV no iCloud
- ❌ Coluna `provider = 'caldav'` em `calendar_connection`

### 2. Calendário do paciente: **`.ics` mantido**

Entregue por dois caminhos:

1. **Anexo do e-mail** com `Content-Type: text/calendar; method=REQUEST; charset=UTF-8`.
   No iOS Mail isso vira um cartão de evento com botão "Adicionar" — sem download,
   sem app extra.
2. **Botão de download** na tela de sucesso.

Complementado por um link `calendar.google.com/.../render?action=TEMPLATE` para quem
usa Google no navegador.

### Por que o `.ics` sobrevive ao corte

O uso primário do site será por **celular e tablet**. No Brasil, uma parcela
relevante desse público usa iPhone com o app Calendário da Apple. Sem `.ics`, esse
paciente sairia da confirmação sem forma de salvar o compromisso — teria que digitar
à mão. Isso aumenta falta, que é justamente o que o agendamento online existe para
reduzir.

Manter o `.ics` custa **um gerador de arquivo de ~120 linhas**, sem credencial, sem
dependência externa e sem ponto de falha em produção. Remover não simplificaria nada
relevante e pioraria o produto para a maioria dos usuários.

## Consequências

- **FASE-06 encolhe:** vira uma fase de geração de `.ics`, sem CalDAV nem feed.
  Estimativa cai de 3–4 dias para 2.
- **FASE-09 perde** a seção de gerenciamento do link `webcal://` no `/admin`.
- **`calendar_connection`** passa a aceitar só `provider = 'google'`.
- **Rota removida:** `/api/calendario/[token]`.
- O gerador de `.ics` continua sendo **componente de primeira classe**, com testes
  contra o RFC 5545:
  - `UID` estável por agendamento — sem isso, cancelar cria evento novo em vez de
    remover;
  - `SEQUENCE` incrementado a cada alteração — sem isso, clientes descartam updates;
  - `METHOD:REQUEST` para criar/atualizar, `METHOD:CANCEL` para cancelar;
  - `VTIMEZONE` embutido com `TZID=America/Sao_Paulo`;
  - CRLF e *folding* em 75 octetos — Apple Calendar é rigoroso e falha em silêncio;
  - escape de `,` `;` `\` e `\n`.
- **Ponto único de falha:** com o iCloud fora, o Google Calendar passa a ser a única
  fonte da agenda. A degradação descrita em [ADR-002](ADR-002-google-fonte-da-verdade.md)
  deixa de ser precaução e vira requisito — se a API do Google cair, não há segunda
  via para consultar disponibilidade.
- Se um dia a médica pedir a agenda no iPhone, a rota mais barata é o feed
  `webcal://` (~1 dia). Registrado em [FASE-14](../fases/FASE-14-roadmap.md).

## Nota sobre o protótipo

O `index.html` já gera `.ics` no cliente — a intuição estava certa. Os defeitos a
corrigir:

```js
// ❌ offset fixo: quebra se o horário de verão voltar
const utc = dt => new Date(dt.getTime() + 3*3600000);
// ❌ UID baseado em Date.now(): muda a cada geração,
//    então cancelar cria um evento novo em vez de remover o antigo
`UID:${Date.now()}@draandressacorreia`
// ❌ sem SEQUENCE: clientes descartam qualquer atualização
```
