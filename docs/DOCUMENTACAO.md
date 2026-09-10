# Site Dra. Andressa Chaves Correia — Documentação

Site profissional com **agendamento online sincronizado com Google Agenda e Apple
Calendar**. Premium, minimalista, em conformidade com LGPD e com as normas de
publicidade médica.

**Este é o documento de entrada.** Comece por aqui.

---

## 1. Índice

### Arquitetura
| Documento | Conteúdo |
|---|---|
| [00-ARQUITETURA](00-ARQUITETURA.md) | Requisitos, decisão central de calendário, stack, modelo de dados, fluxos, segurança |
| [01-MOBILE-FIRST](01-MOBILE-FIRST.md) | **Padrão obrigatório.** O uso primário é celular e tablet — breakpoints, toque, tablet, áreas seguras, checklist |

### Decisões (ADR)
| ADR | Assunto | Em uma frase |
|---|---|---|
| [001](adr/ADR-001-stack.md) | Next.js vs. front estático + FastAPI | Um runtime só, por razão operacional |
| [002](adr/ADR-002-google-fonte-da-verdade.md) | Google como fonte da verdade | É a agenda que ela realmente usa |
| [003](adr/ADR-003-ics-para-o-paciente.md) | `.ics` para o paciente | Agenda da médica só no Google; `.ics` fica porque é formato universal, não Apple |
| [004](adr/ADR-004-antioverbooking.md) | `EXCLUDE USING gist` | O banco impede overbooking, não a aplicação |
| [005](adr/ADR-005-analytics-sem-cookies.md) | Analytics sem cookies | Sem cookie não essencial → sem banner |

### Fases
| # | Fase | Dias | Depende de |
|---|---|---|---|
| [01](fases/FASE-01-design-system.md) | Design System | 3–4 | — |
| [02](fases/FASE-02-fundacao-projeto.md) | Fundação do projeto | 2 | — |
| [03](fases/FASE-03-site-institucional.md) | Site institucional | 4–5 | 01, 02 |
| [04](fases/FASE-04-motor-disponibilidade.md) | **Motor de disponibilidade** | 4 | 02 |
| [05](fases/FASE-05-google-calendar.md) | Google Calendar | 4 | 02, 04 |
| [06](fases/FASE-06-ics-calendario-paciente.md) | `.ics` (calendário do paciente) | 2 | 02 |
| [07](fases/FASE-07-fluxo-agendamento.md) | **Fluxo de agendamento** | 5 | 01, 04, 05, 06 |
| [08](fases/FASE-08-notificacoes.md) | Notificações | 3 | 06, 07 |
| [09](fases/FASE-09-painel-admin.md) | Painel administrativo | 4 | 04, 05, 07 |
| [10](fases/FASE-10-compliance-lgpd-cfm.md) | **LGPD e CFM** | 3 | 03, 07 |
| [11](fases/FASE-11-seo-performance.md) | SEO local e performance | 2–3 | 03 |
| [12](fases/FASE-12-qa-acessibilidade.md) | QA e acessibilidade | 4 | todas |
| [13](fases/FASE-13-deploy-observabilidade.md) | Deploy e observabilidade | 2 | todas |
| [14](fases/FASE-14-roadmap.md) | Roadmap pós-lançamento | — | — |

**Total: 41–44 dias úteis** para um desenvolvedor — ~9 semanas com folga para
revisões. (A FASE-06 encolheu de 3–4 para 2 dias com a remoção da sincronia Apple.) Caminho crítico: **02 → 04 → 05 → 07 → 12 → 13**.

As fases 01, 03, 10 e 11 correm em paralelo com as de backend.

---

## 2. As quatro coisas que definem este projeto

### 2.1 Agenda da médica só no Google; `.ics` para o paciente

São **dois problemas diferentes**, e confundi-los é o erro clássico:

| | Agenda da **médica** | Calendário do **paciente** |
|---|---|---|
| Precisa | Ler e escrever, continuamente | Receber o evento, **uma vez** |
| Quem autentica | Ela, uma vez, no `/admin` | **Ninguém** |
| Solução | Google Calendar API v3 | `.ics` + link do Google |
| Apple | ❌ **fora de escopo** | ✅ o `.ics` cobre |

A sincronização da agenda **dela** com a Apple (feed `webcal://`, CalDAV no iCloud)
foi removida do escopo a pedido do cliente: o Google é a única integração de agenda.

O **`.ics` permanece** — e não é "integração com a Apple". É um formato aberto
(RFC 5545) lido nativamente por Apple Calendar, Google Agenda, Outlook, Samsung e
Thunderbird. Como o uso primário será por celular, sem ele o paciente de iPhone
sairia da confirmação sem forma de salvar o compromisso. Custa um gerador de ~120
linhas, sem credencial e sem dependência externa.

**Consequência a assumir:** o Google vira **ponto único de falha**. A degradação
graciosa (servir cache, manter o agendamento com `sync_state='pending'`) deixa de ser
precaução e vira requisito.

→ [ADR-003](adr/ADR-003-ics-para-o-paciente.md) · [FASE-06](fases/FASE-06-ics-calendario-paciente.md)

### 2.2 O overbooking é impedido pelo banco

Dois pacientes clicam no mesmo horário ao mesmo tempo. Verificar antes de inserir
não resolve — as duas requisições verificam, as duas não encontram nada, as duas
inserem.

```sql
ALTER TABLE appointment ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    practitioner_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('held','confirmed'));
```

O PostgreSQL rejeita a segunda inserção. Nenhum caminho de código consegue violar a
invariante — nem um bug futuro, nem um script manual.

→ [ADR-004](adr/ADR-004-antioverbooking.md)

### 2.3 Celular e tablet são o caso primário, não o secundário

O uso primário do site será por **celular e tablet**. Isso não é requisito de
compatibilidade — é a premissa de projeto, e inverte a ordem de trabalho:

| | Desktop-first (❌) | Mobile-first (✅) |
|---|---|---|
| Ordem | Desenha em 1440, comprime | Desenha em **375**, expande |
| Conteúdo | Tudo cabe; esconde no mobile | Só o essencial; **acrescenta** no desktop |
| Interação | Hover revela informação | Hover **não existe** |
| Alvo | 24–32 px | **≥ 44 px**, 8 px de folga |
| Aprovação | "Ficou bom no monitor" | **Testado no aparelho, na mão** |

Três decisões que decorrem disso e aparecem no código:

- O botão de avançar do agendamento é **sticky no rodapé** no celular, com
  `safe-area-inset-bottom` — senão fica sob a barra de gestos do iPhone.
- Campos com `font-size` ≥ 16 px, senão o iOS dá **zoom automático** ao focar e o
  layout salta.
- O tablet ganha contêiner próprio (680 px). Sem isso, uma coluna de 900 px produz
  medida de linha ilegível — o erro mais comum de site dito "responsivo".

→ [01-MOBILE-FIRST](01-MOBILE-FIRST.md)

### 2.4 O título profissional é uma restrição de conformidade

O currículo mostra pós-graduação em Nutrologia **em curso** (Afya, até jul/2027). O
material de redes sociais fornecido diz "Médica Especialista em Nutrologia".

Anunciar especialidade exige **RQE registrado no CRM**, que não decorre de
pós-graduação Lato Sensu — muito menos em andamento. É infração ética passível de
processo.

**O site usa:** "Médica · com atuação em Nutrologia" / "Pós-graduanda em Nutrologia
(Afya)".
**Nunca:** "Especialista em Nutrologia" · "Nutróloga" · qualquer RQE.

Tecnicamente, isso vira uma constante única em `lib/config.ts` mais um teste de build
que barra essas palavras em qualquer outro arquivo. Em julho de 2027, preencher
`PROFISSIONAL.rqe` atualiza o site inteiro.

→ [FASE-10](fases/FASE-10-compliance-lgpd-cfm.md)

---

## 3. Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript estrito |
| Estilo | Tailwind CSS v4 + tokens CSS |
| Componentes | shadcn/ui (base Radix) |
| Animação | Motion |
| Fontes | Playfair Display + Jost, self-hosted via `next/font` |
| Banco | PostgreSQL (Supabase, `sa-east-1`) + Drizzle |
| Auth (admin) | Auth.js v5 + Google, allowlist de uma conta |
| Calendário | Google Calendar API v3 (médica) · `.ics` RFC 5545 (paciente) |
| E-mail | Resend + React Email |
| Datas | Luxon — **só** em `lib/datetime.ts` |
| Analytics | Plausible/Umami (sem cookies) |
| Erros | Sentry, com PII filtrada |
| Testes | Vitest · Playwright · axe-core |
| Deploy | Vercel + GitHub Actions |

---

## 4. Identidade visual

Derivada do material existente (carrossel de Nutrologia e retratos), não inventada.

**Paleta** — todos os pares verificados por contraste WCAG:

| Token | Hex | Uso | Contraste sobre marfim |
|---|---|---|---|
| `ivory-50` | `#FBF8F3` | Fundo da página | — |
| `ivory-100` | `#F5EFE5` | Superfície | — |
| `sand-400` | `#A08A68` | **Borda de campo** | 3,13 ✅ (UI) |
| `gold-500` | `#B8874E` | Fios, ícones, preenchimento | 3,00 ⚠️ *nunca texto pequeno* |
| `gold-700` | `#8A6230` | **Texto em ouro** | 5,12 ✅ |
| `espresso-900` | `#241A13` | Blocos escuros, tinta | 16,09 ✅ |
| `ink-muted` | `#6B5A4B` | Texto secundário | 6,22 ✅ |

O ouro da marca (`#B8874E`) **reprova para texto pequeno** em fundo claro. Onde ele
aparece como rótulo, o token correto é `gold-700` — visualmente quase idêntico,
acessível. Este é o tipo de detalhe que separa "parece premium" de "é premium".

**Tipografia:** Playfair Display (display) + Jost (corpo) + Cormorant Garamond
Italic (uma citação por página).

**Sem modo escuro**, por decisão de marca: o sistema já opera em duas superfícies
(marfim e espresso), que é o contraste que a identidade pede.

→ [FASE-01](fases/FASE-01-design-system.md)

---

## 5. Fluxo do paciente

```
  Home  →  [Agendar]  →  ① Modalidade  →  ② Data e horário  →  ③ Dados  →  ✓
                                                                             │
              ┌──────────────────────────────────────────────────────────────┤
              ▼                          ▼                          ▼
      Evento na agenda          E-mail + .ics anexo          Botões de calendário
      da médica (Google)        (Apple/Google/Outlook)       na própria tela
```

Sem cadastro. Sem senha. Gestão pós-agendamento por link assinado
(`/consulta/<token>`).

→ [FASE-07](fases/FASE-07-fluxo-agendamento.md)

---

## 6. Regras invioláveis

Se você só ler uma seção, leia esta.

1. **Conversão de fuso só em `lib/datetime.ts`.** Nenhum `+ 3*3600000` em lugar
   nenhum. Regra imposta por ESLint.
2. **A constraint `appointment_no_overlap` nunca é removida.** Ela é a única
   garantia real contra overbooking.
3. **`UID` do `.ics` é estável e `SEQUENCE` sempre incrementa.** Sem isso,
   cancelamento não cancela no iPhone.
4. **Falha de calendário nunca perde agendamento.** `sync_state='pending'` e a fila
   reprocessa.
5. **O título profissional vem de `lib/config.ts`.** Nunca escrito à mão.
6. **Motivo da consulta é dado de saúde:** opcional, com consentimento próprio,
   apagado em 90 dias, nunca em `localStorage`, nunca em log.
7. **Sem preço, sem depoimento, sem antes/depois.** Restrição de publicidade médica.
8. **Nenhum hex cru fora de `globals.css`.**
9. **Nenhuma tela é aprovada sem passar em 375 px, em aparelho real.** Mockup de
   desktop não aprova nada sozinho.
10. **Preview nunca aponta para a agenda real.**
11. **Isto não é prontuário.** Nada de evolução clínica, exame ou prescrição — é o
    que mantém o projeto fora das normas de prontuário eletrônico.

---

## 7. Começando

```bash
git clone <repo> && cd site-andressa
cp .env.example .env.local     # preencher — ver FASE-02 §3
npm install
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev
```

| Comando | O quê |
|---|---|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run test` | Unitários (Vitest) |
| `npm run test:e2e` | E2E (Playwright) |
| `npm run db:migrate` | Aplica migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run check:contrast` | Verifica contraste dos tokens |

---

## 8. Glossário

| Termo | Significado |
|---|---|
| **Slot** | Intervalo agendável (ex.: 15/09 14:00–14:40) |
| **Buffer** | Intervalo entre consultas; entra no bloqueio, não no horário clínico |
| **Hold** | Reserva temporária (10 min) durante o preenchimento |
| **FreeBusy** | Endpoint do Google que devolve só ocupado/livre, sem detalhes |
| **`syncToken`** | Marcador do Google para sincronização incremental |
| **Canal push** | Webhook do Google; expira em ~30 dias e precisa de renovação |
| **`.ics` / iCalendar** | RFC 5545 — formato universal de evento |
| **`SEQUENCE`** | Versão do evento no `.ics`; sem incrementar, updates são ignorados |
| **RQE** | Registro de Qualificação de Especialista, emitido pelo CRM |
| **RIPD** | Relatório de Impacto à Proteção de Dados (LGPD) |
| **Dado sensível** | LGPD Art. 5º, II — inclui informação de saúde |

---

## 9. Sobre este plano

Elaborado a partir de:
- **Currículo** da Dra. Andressa Chaves Correia (formação, atuação, contato)
- **Carrossel de Nutrologia e retratos** (identidade visual e de conteúdo)
- **Protótipo `index.html`** (estrutura de seções e fluxo em 3 etapas — bom ponto de
  partida; os defeitos de `.ics`, fuso e ARIA estão documentados e corrigidos)
- **Skill `ui-ux-pro-max`** (tipografia editorial, regras de acessibilidade,
  formulário e movimento)

Pontos que exigem confirmação antes de codificar:

- [x] ~~**CRM-SP 267.777**~~ — confirmado pelo cliente em 10/09/2026
- [ ] **Endereço do consultório** — ainda não definido (10/09/2026). O plano trata
      isso como estado de primeira classe: `PROFISSIONAL.endereco = null` faz site,
      `.ics` e JSON-LD degradarem para "endereço enviado na confirmação".
      **Custo enquanto durar:** o pacote local do Google ("nutrólogo perto de mim")
      fica praticamente fora de alcance — ver
      [FASE-11](fases/FASE-11-seo-performance.md)
- [ ] **Horários reais de atendimento** — alimentam `availability_rule`
- [ ] **Duração das consultas** — o protótipo assume 40 min
- [ ] **Domínio** — `draandressacorreia.com.br` é hipótese
- [ ] **Revisão jurídica** de publicidade médica antes do go-live
