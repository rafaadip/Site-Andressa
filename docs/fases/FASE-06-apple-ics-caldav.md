# FASE 06 — Apple Calendar, `.ics` e CalDAV

> **Objetivo:** o compromisso entra no calendário de **qualquer** pessoa — iPhone
> incluído — sem API proprietária e sem login.
> **Depende de:** FASE-02 · **Habilita:** FASE-07, FASE-08
> **Estimativa:** 3 dias (+1 opcional para CalDAV)
> **Base:** [ADR-003](../adr/ADR-003-apple-sem-api.md)

---

## 1. O ponto de partida

A Apple **não tem API REST de calendário**. Quem procura um "Apple Calendar API"
não encontra porque não existe: EventKit é local (apps nativos), e "Sign in with
Apple" só autentica identidade.

O que existe é melhor do que parece: **iCalendar (RFC 5545)** é um padrão aberto que
Apple Calendar, Google, Outlook, Samsung e Thunderbird leem nativamente. Um arquivo
`.ics` correto resolve o problema do paciente em **todas** as plataformas de uma vez.

O trabalho desta fase é gerar um `.ics` *rigorosamente* correto — porque o Apple
Calendar é o cliente mais exigente do mercado e falha em silêncio quando algo está
fora do RFC.

---

## 2. O gerador de `.ics`

### 2.1 Requisitos do RFC que não podem ser ignorados

| Requisito | Por quê | O que acontece se errar |
|---|---|---|
| Quebra de linha **CRLF** (`\r\n`) | RFC 5545 §3.1 | Apple Calendar recusa o arquivo |
| *Folding* em 75 octetos | RFC 5545 §3.1 | Linha longa corrompe o campo |
| `UID` **estável** por agendamento | RFC 5545 §3.8.4.7 | Cancelar cria um evento novo em vez de remover |
| `SEQUENCE` incrementado a cada alteração | RFC 5545 §3.8.7.4 | Clientes **descartam** a atualização |
| `DTSTAMP` obrigatório | RFC 5545 §3.8.7.2 | Arquivo inválido |
| `VTIMEZONE` quando usa `TZID` | RFC 5545 §3.6.5 | Apple assume UTC → evento na hora errada |
| Escape de `,` `;` `\` `\n` | RFC 5545 §3.3.11 | Descrição truncada no primeiro `,` |
| `METHOD` coerente com o `Content-Type` | RFC 6047 | iOS Mail não mostra o botão "Adicionar" |

### 2.2 Implementação

```ts
// lib/calendar/ics.ts
const CRLF = '\r\n';

/** RFC 5545 §3.1 — dobra em 75 octetos (não caracteres: UTF-8 conta bytes). */
function dobrar(linha: string): string {
  const bytes = Buffer.from(linha, 'utf8');
  if (bytes.length <= 75) return linha;
  const partes: string[] = [];
  let inicio = 0;
  while (inicio < bytes.length) {
    const limite = inicio === 0 ? 75 : 74;   // continuação começa com espaço
    let fim = Math.min(inicio + limite, bytes.length);
    // não cortar no meio de um code point UTF-8
    while (fim > inicio && fim < bytes.length && (bytes[fim]! & 0xc0) === 0x80) fim--;
    partes.push((inicio === 0 ? '' : ' ') + bytes.subarray(inicio, fim).toString('utf8'));
    inicio = fim;
  }
  return partes.join(CRLF);
}

/** RFC 5545 §3.3.11 — a ordem importa: barra invertida primeiro. */
function escapar(v: string): string {
  return v.replace(/\\/g, '\\\\')
          .replace(/;/g, '\\;')
          .replace(/,/g, '\\,')
          .replace(/\r?\n/g, '\\n');
}

export function gerarIcs(ag: Agendamento, metodo: 'REQUEST' | 'CANCEL'): string {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dra Andressa Correia//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    `METHOD:${metodo}`,
    ...VTIMEZONE_SAO_PAULO,          // bloco literal, ver §2.3
    'BEGIN:VEVENT',
    `UID:${ag.icsUid}`,              // ESTÁVEL — nunca Date.now()
    `SEQUENCE:${ag.icsSequence}`,    // incrementa a cada alteração
    `DTSTAMP:${emUtcCompacto(new Date())}`,
    `DTSTART;TZID=America/Sao_Paulo:${emLocalCompacto(ag.inicio)}`,
    `DTEND;TZID=America/Sao_Paulo:${emLocalCompacto(ag.fim)}`,
    dobrar(`SUMMARY:${escapar(`${ag.tipoLabel} — ${PROFISSIONAL.nomeCurto}`)}`),
    dobrar(`DESCRIPTION:${escapar(descricao(ag))}`),
    dobrar(`LOCATION:${escapar(ag.local)}`),
    `STATUS:${metodo === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    dobrar(`ORGANIZER;CN=${escapar(PROFISSIONAL.nomeCurto)}:mailto:${env.EMAIL_FROM_ADDR}`),
    dobrar(`ATTENDEE;CN=${escapar(ag.pacienteNome)};RSVP=FALSE:mailto:${ag.pacienteEmail}`),
    ...(metodo === 'REQUEST' ? [
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY',
      'DESCRIPTION:Lembrete de consulta', 'END:VALARM',
    ] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return linhas.join(CRLF) + CRLF;
}
```

### 2.3 `VTIMEZONE`

Bloco literal para `America/Sao_Paulo` no regime atual (UTC−3 fixo desde o Decreto
9.772/2019):

```
BEGIN:VTIMEZONE
TZID:America/Sao_Paulo
X-LIC-LOCATION:America/Sao_Paulo
BEGIN:STANDARD
TZOFFSETFROM:-0300
TZOFFSETTO:-0300
TZNAME:-03
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE
```

> **Nota de manutenção:** se o horário de verão voltar, este bloco precisa ganhar um
> componente `DAYLIGHT` com `RRULE`. Marcado com `// TODO(dst)` no código e listado
> em FASE-14. Como usamos `TZID` (e não UTC convertido), clientes com base tz
> atualizada corrigem sozinhos — o `VTIMEZONE` embutido é o fallback.

### 2.4 Erros do protótipo, corrigidos aqui

```js
// index.html — o que muda
const utc = dt => new Date(dt.getTime() + 3*3600000);  // ❌ offset fixo
`UID:${Date.now()}@draandressacorreia`                 // ❌ UID volátil
// ❌ sem SEQUENCE, sem VTIMEZONE, sem folding, sem METHOD:CANCEL
```

O `UID` volátil é o mais grave: sem ele, **cancelar não cancela** — o cliente recebe
um evento desconhecido e o adiciona.

---

## 3. Entrega ao paciente

### 3.1 Anexo de e-mail (caminho principal)

```ts
await resend.emails.send({
  from: env.EMAIL_FROM,
  to: ag.pacienteEmail,
  subject: `Consulta confirmada — ${formatarParaPaciente(ag.inicio)}`,
  react: <EmailConfirmacao {...ag} />,
  attachments: [{
    filename: 'consulta.ics',
    content: Buffer.from(gerarIcs(ag, 'REQUEST')).toString('base64'),
    contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
  }],
});
```

O `contentType` com `method=REQUEST` é o que faz o **iOS Mail** renderizar o cartão
de evento com botão "Adicionar", em vez de um anexo genérico. Sem isso, o iPhone
mostra um arquivo que a maioria das pessoas ignora.

### 3.2 Download direto (`/api/ics/[id]`)

```ts
return new Response(gerarIcs(ag, 'REQUEST'), {
  headers: {
    'Content-Type': 'text/calendar; charset=utf-8; method=REQUEST',
    'Content-Disposition': 'attachment; filename="consulta-dra-andressa.ics"',
    'Cache-Control': 'no-store',
  },
});
```

### 3.3 Link do Google Calendar

Para quem usa Google no navegador, um `.ics` é fricção. Link direto:

```ts
const url = new URL('https://calendar.google.com/calendar/render');
url.searchParams.set('action', 'TEMPLATE');
url.searchParams.set('text', `${tipo.label} — ${PROFISSIONAL.nomeCurto}`);
url.searchParams.set('dates', `${compacto(inicio)}/${compacto(fim)}`); // UTC + 'Z'
url.searchParams.set('details', detalhes);
url.searchParams.set('location', local);
url.searchParams.set('ctz', 'America/Sao_Paulo');
```

### 3.4 Como isso aparece na tela de sucesso

```
        ✓  Consulta confirmada

     Segunda, 15 de setembro às 14:00
     Consulta em Nutrologia · Presencial

  ┌──────────────────────────────────────┐
  │  Adicionar ao calendário             │
  │  [ Apple / Outlook (.ics) ]          │  ← download
  │  [ Google Agenda ]                   │  ← link
  └──────────────────────────────────────┘

  Enviamos também para seu e-mail.
  [ Confirmar pelo WhatsApp ]
```

Rotular como "Apple / Outlook" em vez de ".ics" — o paciente não precisa saber o
nome do formato.

---

## 4. Calendário da médica no iPhone

### 4.1 Rota padrão — feed `webcal://` (recomendada)

```
GET /api/calendario/<token>.ics
→ VCALENDAR com todos os agendamentos confirmados dos próximos 180 dias
```

Ela assina uma vez: **Ajustes → Aplicativos → Calendário → Contas → Adicionar
Conta → Outra → Adicionar Calendário Assinado**, colando
`webcal://draandressacorreia.com.br/api/calendario/<token>.ics`.

- ✅ Nenhuma credencial da Apple no nosso servidor
- ✅ Nunca quebra por troca de senha
- ✅ Funciona também em Google Agenda ("Adicionar por URL") e Outlook
- ⚠️ Somente leitura; iOS atualiza a cada ~15 min–1 h

Segurança: token de 32 bytes (`randomBytes(32).toString('base64url')`), revogável no
`/admin`, resposta com `X-Robots-Tag: noindex` e `Cache-Control: private, max-age=300`.

### 4.2 Rota opcional — CalDAV (atrás de flag)

Só se ela pedir evento nativo e editável no iCloud.

```
Servidor : https://caldav.icloud.com
Auth     : Basic — Apple ID + SENHA DE APP (appleid.apple.com)
Descoberta: PROPFIND current-user-principal → calendar-home-set
Escrita  : PUT /<home>/<calendario>/<uid>.ics  (corpo = VEVENT)
Remoção  : DELETE no mesmo href
```

Riscos assumidos, e por isso é opcional: a senha de app é credencial de longa
duração no nosso banco; ela é invalidada quando a médica troca a senha do Apple ID,
**sem aviso**; não há push (exigiria polling); o iCloud tem particularidades mal
documentadas de `PROPFIND`.

Se implementado: senha cifrada como o refresh token do Google, verificação de saúde
diária, e alerta no `/admin` na primeira falha de autenticação.

---

## 5. Entregáveis

- [ ] `lib/calendar/ics.ts` — gerador com folding, escape, `VTIMEZONE`, `SEQUENCE`
- [ ] `app/api/ics/[id]/route.ts`
- [ ] `app/api/calendario/[token]/route.ts` — feed assinado
- [ ] `lib/calendar/google-link.ts`
- [ ] `/admin/integracoes` — gerar/copiar/revogar link do feed, com instruções
      passo a passo para iPhone
- [ ] `lib/calendar/caldav.ts` — **opcional**, atrás de `ENABLE_CALDAV`

## 6. Critérios de aceite

- [ ] `.ics` validado por biblioteca independente (`ical.js`) sem erro
- [ ] Abre corretamente em **Apple Calendar (iOS e macOS)**, Google Agenda, Outlook
      Web e Thunderbird — teste manual documentado com prints
- [ ] Anexo no iOS Mail mostra o cartão de evento com botão "Adicionar"
- [ ] Cancelar envia `METHOD:CANCEL` com o **mesmo `UID`** e `SEQUENCE` maior — e o
      evento **desaparece** do calendário do paciente
- [ ] Remarcar atualiza o evento existente, sem duplicar
- [ ] Descrição com vírgula, ponto-e-vírgula e quebra de linha sobrevive íntegra
- [ ] Nome com acento (ex.: "José Antônio Gonçalves") não corrompe o folding
- [ ] Feed `webcal://` assinado no iPhone mostra os agendamentos corretos
- [ ] Token de feed revogado retorna 404
