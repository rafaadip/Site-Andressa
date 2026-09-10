# ADR-005 — Analytics sem cookies para eliminar o banner de consentimento

- **Status:** Aceita
- **Data:** 2026-09-10

## Contexto

O briefing pede um site **premium e minimalista**. O primeiro elemento que o
visitante vê num site típico é um banner de cookies cobrindo o conteúdo — o
oposto de ambas as coisas.

Ao mesmo tempo, a médica precisa saber o básico: quantas pessoas visitam, de onde
vêm, quantas concluem o agendamento.

## Contexto legal

A LGPD não exige banner por si só; ela exige **base legal** para o tratamento. O que
força o banner é o uso de cookies **não essenciais** (analytics, publicidade,
rastreamento entre sites), que exigem consentimento prévio e revogável.

Se **não existe** cookie não essencial, não existe o que consentir.

Dois outros pontos costumam passar batido:

- **Google Fonts via CDN** transmite o IP do visitante para servidores do Google a
  cada carregamento — decisões europeias já trataram isso como transferência que
  demanda base legal. `next/font` com self-host resolve, e ainda melhora o LCP.
- **Google Analytics** grava `_ga` em `localStorage`/cookie e transfere dados para
  fora do Brasil. Exigiria banner e cláusula na política de privacidade.

## Decisão

1. **Plausible** (hospedado na UE) ou **Umami** (self-host) — sem cookies, sem
   identificador persistente, métricas agregadas.
2. **Sem Google Analytics.**
3. **Fontes self-hosted** via `next/font/local`.
4. **Sem pixel** de Meta/Google Ads no MVP.
5. **Sem banner de cookies.** A política de privacidade explica, em uma frase, que o
   site não usa cookies de rastreamento.

Cookies estritamente necessários que permanecem (sessão do `/admin`, token CSRF) são
isentos de consentimento — e nem chegam ao visitante público.

## O que se perde, e por quê tudo bem

- Sem cohort/retorno por usuário. **Irrelevante:** ninguém "retorna" a um site de
  consultório como retorna a um SaaS.
- Sem remarketing. **Fora do escopo:** publicidade médica é restrita pelo CFM.
- Métricas de funil ainda funcionam: eventos anônimos
  (`agendamento_iniciado`, `slot_selecionado`, `agendamento_confirmado`) dão a taxa
  de conversão sem identificar ninguém.

## Consequências

- A política de privacidade fica curta e verdadeira — o que é, por si só, um sinal
  de qualidade.
- Nenhum elemento cobre o conteúdo no primeiro carregamento; o LCP não compete com
  script de terceiro.
- Se um dia a médica quiser anunciar (Google Ads), a decisão deve ser revisitada:
  aí entram banner de consentimento, CMP e revisão da política. Está registrado no
  roadmap (FASE-14) como mudança **consciente**, não acidental.
