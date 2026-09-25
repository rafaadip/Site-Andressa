# FASE 06 — `.ics`: o compromisso no calendário do paciente

> **Objetivo:** o compromisso entra no calendário de **qualquer** paciente — iPhone
> incluído — sem API proprietária e sem login.
> **Depende de:** FASE-02 · **Habilita:** FASE-07, FASE-08
> **Estimativa:** 2 dias
> **Base:** [ADR-003](../adr/ADR-003-ics-para-o-paciente.md)
>
> ⚠️ **Escopo revisado.** A sincronização da agenda da **médica** com a Apple (feed
> `webcal://` e CalDAV no iCloud) foi **removida** a pedido do cliente. A agenda dela
> é exclusivamente Google ([FASE-05](FASE-05-google-calendar.md)). Esta fase trata
> apenas do lado do **paciente**.

---

## 1. Por que o `.ics` continua, mesmo "só com Google"

O `.ics` **não é integração com a Apple** — é um formato aberto (RFC 5545) lido
nativamente por Apple Calendar, Google Agenda, Outlook, Samsung Calendar e
Thunderbird.

O uso primário do site será por celular e tablet
([01-MOBILE-FIRST](../01-MOBILE-FIRST.md)). Boa parte desse público usa iPhone com o
app Calendário. Sem `.ics`, esse paciente termina a confirmação sem forma de salvar o
compromisso — digitaria à mão, ou não salvaria. Isso aumenta falta, que é exatamente
o que o agendamento online existe para reduzir.

Custo de manter: um gerador de ~120 linhas, sem credencial, sem dependência externa,
sem ponto de falha em produção.

**Cobertura com um único artefato:**

| Cliente | Como recebe |
|---|---|
| Apple Calendar (iOS/macOS) | `.ics` anexo ou baixado |
| Google Agenda | link `TEMPLATE` (ou `.ics`) |
| Outlook (web/desktop) | `.ics` |
| Samsung Calendar | `.ics` |
| Thunderbird | `.ics` |

---

## 2. O gerador de `.ics`

### 2.1 Requisitos do RFC que não podem ser ignorados

Apple Calendar é o cliente mais rigoroso do mercado e **falha em silêncio** quando
algo está fora do RFC — não há mensagem de erro, o evento simplesmente não aparece.

| Requisito | Por quê | O que acontece se errar |
|---|---|---|
| Quebra de linha **CRLF** (`\r\n`) | RFC 5545 §3.1 | Apple Calendar recusa o arquivo |
| *Folding* em 75 octetos | RFC 5545 §3.1 | Linha longa corrompe o campo |
| `UID` **estável** por agendamento | RFC 5545 §3.8.4.7 | Cancelar cria evento novo em vez de remover |
| `SEQUENCE` incrementado a cada alteração | RFC 5545 §3.8.7.4 | Clientes **descartam** a atualização |
| `DTSTAMP` obrigatório | RFC 5545 §3.8.7.2 | Arquivo inválido |
| `VTIMEZONE` quando usa `TZID` | RFC 5545 §3.6.5 | Cliente assume UTC → evento na hora errada |
| Escape de `,` `;` `\` `\n` | RFC 5545 §3.3.11 | Descrição truncada na primeira vírgula |
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
          .replace(/;/g, '\;')
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
    dobrar(`LOCATION:${escapar(ag.local)}`),   // localConsulta() — FASE-03 §3.1
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
> em [FASE-14](FASE-14-roadmap.md). Como usamos `TZID` (e não UTC convertido),
> clientes com base tz atualizada corrigem sozinhos — o `VTIMEZONE` embutido é o
> fallback.

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
mostra um arquivo que a maioria das pessoas ignora — e este é o principal caminho
num público mobile.

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

Para quem usa Google, um `.ics` é fricção desnecessária. Link direto:

```ts
const url = new URL('https://calendar.google.com/calendar/render');
url.searchParams.set('action', 'TEMPLATE');
url.searchParams.set('text', `${tipo.label} — ${PROFISSIONAL.nomeCurto}`);
url.searchParams.set('dates', `${compacto(inicio)}/${compacto(fim)}`); // UTC + 'Z'
url.searchParams.set('details', detalhes);
url.searchParams.set('location', local);
url.searchParams.set('ctz', 'America/Sao_Paulo');
```

### 3.4 Como aparece na tela de sucesso

Layout mobile-first — os dois botões empilhados, largura total, 48 px de altura:

```
        ✓  Consulta confirmada

     Segunda, 15 de setembro às 14:00
     Consulta em Nutrologia · Presencial

  ┌────────────────────────────────────┐
  │  Adicionar ao calendário           │
  │  ┌──────────────────────────────┐  │
  │  │  Google Agenda               │  │  ← link
  │  ├──────────────────────────────┤  │
  │  │  Apple, Outlook e outros     │  │  ← download .ics
  │  └──────────────────────────────┘  │
  └────────────────────────────────────┘

  Enviamos também para seu e-mail.
  [ Confirmar pelo WhatsApp ]
```

Rotular por **destino**, não por formato — o paciente não precisa saber o que é um
`.ics`. Em tablet e desktop os dois botões ficam lado a lado.

---

## 4. Entregáveis

- [ ] `lib/calendar/ics.ts` — gerador com folding, escape, `VTIMEZONE`, `SEQUENCE`
- [ ] `app/api/ics/[id]/route.ts`
- [ ] `lib/calendar/google-link.ts`
- [ ] Testes contra `ical.js` (biblioteca independente)

**Fora de escopo** (removidos por [ADR-003](../adr/ADR-003-ics-para-o-paciente.md)):
- ~~`app/api/calendario/[token]/route.ts` — feed `webcal://`~~
- ~~`lib/calendar/caldav.ts` — escrita no iCloud~~
- ~~UI de gestão do feed em `/admin/integracoes`~~

## 5. Critérios de aceite

- [ ] `.ics` validado por biblioteca independente (`ical.js`) sem erro
- [ ] Abre corretamente em **Apple Calendar (iOS e macOS)**, Google Agenda, Outlook
      Web e Thunderbird — teste manual documentado com prints
- [ ] Anexo no iOS Mail mostra o cartão de evento com botão "Adicionar"
- [ ] Cancelar envia `METHOD:CANCEL` com o **mesmo `UID`** e `SEQUENCE` maior — e o
      evento **desaparece** do calendário do paciente
- [ ] Remarcar atualiza o evento existente, sem duplicar
- [ ] Descrição com vírgula, ponto-e-vírgula e quebra de linha sobrevive íntegra
- [ ] Nome com acento (ex.: "José Antônio Gonçalves") não corrompe o folding
- [ ] Botões de calendário utilizáveis com uma mão em tela de 375 px
