# FASE 09 — Painel administrativo

> **Objetivo:** a médica opera a própria agenda sozinha, do celular, entre um
> atendimento e outro.
> **Depende de:** FASE-04, FASE-05, FASE-07 · **Estimativa:** 4 dias

---

## 1. Premissa de projeto

O usuário deste painel é **uma médica plantonista** — vai abri-lo no celular, com
pressa, no intervalo entre atendimentos. Isso descarta a interface de dashboard
denso, com tabelas largas e menu lateral.

Consequências:
- **Mobile-first de verdade**, não "responsivo depois".
- Ações mais frequentes acessíveis em **um toque** a partir da tela inicial.
- Nada de confirmação em duas etapas para operações reversíveis.
- Texto grande; sem tabela que exige rolagem horizontal.

---

## 2. Autenticação

Auth.js v5 + Google Provider, restrito a **uma** conta:

```ts
callbacks: {
  async signIn({ profile }) {
    return profile?.email === env.ADMIN_EMAIL && profile.email_verified === true;
  },
},
session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
```

Escolhas: sem cadastro de usuário (não há segundo usuário); sessão de 30 dias (ela
não vai querer logar toda semana); `middleware.ts` protege `/admin/*`; o mesmo
consentimento do Google já concede os escopos de Calendar (FASE-05).

---

## 3. Telas

### 3.1 `/admin` — Agenda

```
  Hoje · quinta, 11 de setembro          [ Bloquear horário ]

  ┌──────────────────────────────────────────────┐
  │ 14:00  Ana Souza                             │
  │        Consulta presencial · 40 min          │
  │        (11) 99999-0000                       │
  │        "Retorno de exames"                   │
  │        [ WhatsApp ]  [ Remarcar ]  [ ⋯ ]     │
  ├──────────────────────────────────────────────┤
  │ 15:30  Carlos Lima · Teleconsulta            │
  └──────────────────────────────────────────────┘

  Amanhã (2)                                   ⌄
  Esta semana (7)                              ⌄
```

- Agrupado por dia, hoje sempre expandido.
- Telefone é `tel:` e link de WhatsApp — um toque para ligar.
- Motivo da consulta visível (é dado de saúde: só aqui, atrás de login).
- `⋯`: cancelar · marcar como falta · copiar dados.

### 3.2 `/admin/disponibilidade`

Duas abas:

**Semana padrão** — grade de dia × faixa horária, com toque para alternar:

```
        seg   ter   qua   qui   sex   sáb
  Manhã  ─     ●     ─     ●     ●     ─
  Tarde  ●     ●     ─     ●     ●     ─
  Noite  ─     ─     ─     ─     ─     ─
```

Faixas configuráveis (padrão: manhã 08–12, tarde 14–18, noite 19–21), com modalidade
por faixa (presencial / teleconsulta / ambas).

**Exceções** — lista de bloqueios e datas extras:

```
  [ + Bloquear período ]

  ✕  20–27 out    Férias
  ✕  15 set, 08–14h  Plantão UPA
  +  Sáb 27 set, 09–12h  Mutirão (extra)
```

Atalho essencial: **"Bloquear o resto de hoje"** — um botão, para quando um plantão
estende.

### 3.3 `/admin/integracoes`

```
  Google Agenda
  ● Conectado — andressa15correia@gmail.com
    Última sincronização: há 2 minutos
    [ Reconectar ]  [ Desconectar ]

  Apple Calendar / iPhone
  ○ Não assinado
    Assine este link no seu iPhone para ver os
    agendamentos no app Calendário:

    webcal://draandressacorreia.com.br/api/calendario/xK9…
    [ Copiar ]  [ Gerar novo link ]

    ▸ Como assinar no iPhone (passo a passo)
```

O passo a passo do iPhone precisa ser literal, com os nomes exatos dos menus — ela
vai fazer isso uma vez, sozinha, sem suporte.

### 3.4 `/admin/configuracoes`

Modalidades (nome, duração, buffers, ativo), políticas (antecedência mínima,
horizonte, prazo de cancelamento) e textos do e-mail de confirmação.

---

## 4. Ações críticas

| Ação | Confirmação? | Efeito |
|---|---|---|
| Cancelar agendamento | ✅ modal, com campo de motivo opcional | `.ics` `METHOD:CANCEL` + e-mail + remove do Google |
| Bloquear período com agendamento dentro | ✅ lista quem será afetado | Só bloqueia após decidir o que fazer com cada um |
| Desconectar Google | ✅ | Revoga token; agendamentos existentes permanecem |
| Gerar novo link do feed | ✅ | Invalida o anterior — ela precisa reassinar no iPhone |
| Exportar dados (LGPD) | — | CSV + JSON |

**Regra:** bloquear um período que contém agendamentos **nunca** cancela em silêncio.
A tela lista os afetados e exige uma decisão por agendamento (remarcar ou cancelar
com aviso).

---

## 5. Entregáveis

- [ ] Auth.js com allowlist de uma conta + `middleware.ts`
- [ ] `/admin` (agenda), `/admin/disponibilidade`, `/admin/integracoes`,
      `/admin/configuracoes`
- [ ] Server Actions para bloqueio, cancelamento e remarcação
- [ ] Exportação LGPD (CSV + JSON)
- [ ] `noindex` em todo o `/admin`

## 6. Critérios de aceite

- [ ] E-mail fora da allowlist não entra, nem com sessão válida do Google
- [ ] Toda operação do dia a dia é usável em 375 px, com uma mão
- [ ] Bloquear período com agendamento exige decisão explícita
- [ ] Cancelar pelo painel notifica o paciente e limpa a agenda do Google
- [ ] "Bloquear o resto de hoje" leva ≤ 2 toques a partir de `/admin`
- [ ] `/admin` não aparece no `sitemap.xml` nem é indexável
