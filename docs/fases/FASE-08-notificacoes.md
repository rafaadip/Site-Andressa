# FASE 08 — Notificações

> **Objetivo:** o paciente sabe que está marcado, lembra no dia, e a médica sabe da
> agenda. Sem virar spam.
> **Depende de:** FASE-06, FASE-07 · **Estimativa:** 3 dias

---

## 1. Matriz de notificações

| Evento | Para o paciente | Para a médica | Canal |
|---|---|---|---|
| Agendamento confirmado | ✅ imediato, com `.ics` | ✅ imediato | E-mail |
| Cancelado pelo paciente | ✅ confirmação | ✅ imediato | E-mail |
| Cancelado/movido pela médica | ✅ com `.ics` atualizado | — | E-mail |
| Lembrete D-1 (18h) | ✅ | — | E-mail (WhatsApp em v1.1) |
| Lembrete H-2 | ✅ | — | E-mail + alarme do `.ics` |
| Falha de sincronização (5ª tentativa) | — | ✅ | E-mail + Sentry |
| Agenda desconectada | — | ✅ | E-mail + aviso no `/admin` |

**Teto rígido:** no máximo **3** e-mails por agendamento no caminho feliz
(confirmação, D-1, H-2). Mais que isso é ruído, e ruído leva ao "marcar como spam" —
que derruba a entregabilidade de todos os outros.

---

## 2. E-mails

React Email + Resend. Template base sóbrio: marfim, uma linha em ouro no topo,
tipografia serifada no título.

**Restrições de e-mail que ditam o design:**
- Layout em tabela — Flexbox e Grid não funcionam no Outlook desktop
- CSS inline (o `<style>` é removido por vários clientes)
- Largura máxima 600 px
- Fontes web não carregam: fallback `Georgia, serif` / `system-ui`
- Imagem bloqueada por padrão → **nenhuma informação essencial dentro de imagem**
- Alvo de toque ≥ 44 px também aqui — a maioria abrirá o e-mail no celular
- Botões em largura total no mobile; corpo com `max-width: 600px` e padding lateral
  de 16 px, senão o texto encosta na borda em telas de 375 px
- Versão texto puro obrigatória (entregabilidade + leitores de tela)

### Confirmação

```
Assunto: Consulta confirmada — segunda, 15 de setembro às 14:00

  Olá, Ana.

  Sua consulta está confirmada.

  ┌──────────────────────────────────────┐
  │  Consulta em Nutrologia              │
  │  Segunda, 15 de setembro · 14:00     │
  │  Consultório em Guarulhos – SP       │
  │  Duração: 40 minutos                 │
  └──────────────────────────────────────┘

  📎 consulta.ics — toque para adicionar ao calendário

  [ Adicionar ao Google Agenda ]
  [ Remarcar ou cancelar ]

  Chegue com 10 minutos de antecedência.
  Traga exames recentes, se tiver.

  ⓘ Enquanto o endereço do consultório não estiver
    definido, este e-mail traz o local por extenso
    e o lembrete D-1 repete a informação. Ver
    FASE-03 §3.1.

  ─────────────────────────────────────
  Dra. Andressa Chaves Correia · CRM-SP 267.777
  Este e-mail não atende urgências. Em emergência,
  procure o pronto-socorro ou ligue 192.
```

O `.ics` vem como anexo com `method=REQUEST` — no iOS Mail vira cartão de evento com
botão "Adicionar" (FASE-06 §3.1).

### Lembrete D-1

Curto. Data, hora, local, link de mapa (se presencial) e link para cancelar. O link
de cancelar num lembrete **reduz** falta: quem não vem, avisa, e o horário é
reaproveitado.

---

## 3. Entregabilidade

Sem isso, tudo o mais é irrelevante — e-mail em spam é e-mail que não existe.

1. **Domínio próprio** (`contato@draandressacorreia.com.br`), nunca `@gmail.com` como
   remetente — Gmail rejeita spoofing do próprio domínio.
2. **SPF** — registro TXT autorizando a Resend.
3. **DKIM** — CNAMEs fornecidos pela Resend.
4. **DMARC** — começar em `p=none` com relatório, subir para `p=quarantine` após
   duas semanas limpas.
5. **`Reply-To`** apontando para o e-mail pessoal dela.
6. **List-Unsubscribe** só nos lembretes — transacional de confirmação não leva.
7. Monitorar bounce e reclamação pelo webhook da Resend; e-mail com hard bounce é
   marcado no banco e a médica é avisada para confirmar por WhatsApp.

---

## 4. WhatsApp

### MVP — link `wa.me`

Zero custo, zero aprovação. Botão na tela de sucesso e no e-mail, com mensagem
pré-preenchida:

```
https://wa.me/5511998053826?text=<mensagem urlencoded>
```

> Olá, Dra. Andressa! Confirmando meu agendamento pelo site:
> • Consulta em Nutrologia
> • Segunda, 15/09 às 14:00
> • Nome: Ana Souza

Vantagem que o e-mail não tem: abre a conversa e cria o vínculo direto.

### v1.1 — WhatsApp Business Cloud API

Para lembretes automáticos. Requisitos reais que devem ser considerados antes de
prometer prazo:

- Conta no Meta Business + número dedicado (**não** pode ser o WhatsApp pessoal dela)
- **Templates aprovados** pela Meta (categoria *Utility*), com prazo de análise
- Cobrança por conversa iniciada
- Opt-in explícito do paciente registrado — exigência da Meta **e** da LGPD

Fica em FASE-14, com escopo próprio.

---

## 5. Agendamento dos lembretes

Vercel Cron:

```
/api/cron/lembretes-d1   → 0 21 * * *   (18:00 em Brasília = 21:00 UTC)
/api/cron/lembretes-h2   → 0 * * * *    (de hora em hora, janela de 2h–3h)
```

```sql
-- D-1
SELECT * FROM appointment
WHERE status = 'confirmed'
  AND starts_at::date = (now() AT TIME ZONE 'America/Sao_Paulo' + interval '1 day')::date
  AND reminder_d1_at IS NULL;
```

Marcar `reminder_d1_at` **depois** do envio bem-sucedido. Sem essa coluna, uma
reexecução do cron manda o lembrete duas vezes.

> ⚠️ O cron roda em UTC. Escrever `0 18 * * *` mandaria o lembrete às 15h de
> Brasília. Erro clássico — comentar no arquivo de configuração.

---

## 6. Entregáveis

- [ ] `lib/email/templates/` — Confirmacao, Cancelamento, Remarcacao, LembreteD1,
      LembreteH2, AvisoMedica
- [ ] `lib/email/client.ts` — envio com retry e log
- [ ] `app/api/cron/lembretes-{d1,h2}/route.ts`
- [ ] `app/api/webhooks/resend/route.ts` — bounce e reclamação
- [ ] SPF, DKIM e DMARC configurados e verificados
- [ ] Colunas `reminder_d1_at`, `reminder_h2_at` em `appointment`

## 7. Critérios de aceite

- [ ] Confirmação chega em < 30 s
- [ ] Anexo `.ics` abre no Apple Mail (iOS), Gmail (web e app) e Outlook
- [ ] Layout íntegro em Gmail, Apple Mail, Outlook e Yahoo (teste com Litmus ou
      contas reais)
- [ ] Versão texto puro legível e completa
- [ ] Cron rodado duas vezes **não** duplica lembrete
- [ ] Nenhum lembrete para agendamento cancelado
- [ ] SPF, DKIM e DMARC passando (`mail-tester` ≥ 9/10)
- [ ] Máximo de 3 e-mails por agendamento no caminho feliz
