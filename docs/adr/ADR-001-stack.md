# ADR-001 — Next.js full-stack em vez de front estático + FastAPI

- **Status:** Aceita
- **Data:** 2026-09-10
- **Contexto de:** [00-ARQUITETURA §5](../00-ARQUITETURA.md#5-stack)

## Contexto

O protótipo `index.html` entregue traz comentários que apontam para um backend
Python:

```js
/* INTEGRAÇÃO FUTURA: substituir gerarSlots() por
   fetch('/api/disponibilidade?data=YYYY-MM-DD') no FastAPI. */
```

A opção "HTML/CSS estático + API FastAPI separada" é, portanto, a hipótese padrão do
projeto e precisa ser avaliada de forma explícita, não descartada por omissão.

O sistema precisa de servidor por três motivos que não têm como ficar no cliente:
guardar refresh token OAuth, consultar o FreeBusy da médica e impedir overbooking
com transação de banco.

## Opções

### A. HTML estático + FastAPI (Python)

- ➕ FastAPI é excelente: tipagem com Pydantic, OpenAPI automático, async nativo.
- ➕ Se um dia entrar processamento de dados/ML, o ecossistema já está lá.
- ➖ **Dois deploys, dois runtimes, dois gerenciadores de dependência.**
- ➖ CORS, cookies e variáveis de ambiente precisam ser mantidos coerentes entre os
  dois lados — a fonte mais comum de bug "só em produção".
- ➖ O HTML estático teria que reimplementar à mão roteamento, `<head>` por página,
  otimização de imagem e code splitting.
- ➖ Duplicação de schema: validação em Zod no cliente e em Pydantic no servidor,
  que divergem com o tempo.

### B. Next.js 15 App Router (full-stack, um runtime)

- ➕ Um deploy, um `package.json`, um conjunto de env vars.
- ➕ React Server Components entregam HTML puro nas páginas institucionais — que é
  onde o SEO local ("médica nutrologia Guarulhos") de fato acontece.
- ➕ Route Handlers cobrem OAuth, webhook e API de agendamento no mesmo projeto.
- ➕ **Um único schema Zod** valida no formulário e no handler.
- ➕ `next/image`, `next/font` e o Metadata API resolvem, prontos, os itens de
  performance do RNF-01.
- ➖ Vendor lock-in parcial com a Vercel (mitigável: roda em Node self-hosted).
- ➖ Menos confortável para quem tem base Python.

### C. Astro + FastAPI

- ➕ Astro entrega zero JS por padrão — o melhor resultado possível no institucional.
- ➖ Mantém o problema de dois deploys da opção A, e o formulário de agendamento é
  interativo o suficiente para precisar de uma *island* React de qualquer forma.

## Decisão

**Opção B — Next.js 15 App Router.**

O fator decisivo não é técnico, é operacional: este projeto é mantido por **uma
pessoa** e atende **uma médica**. O custo permanente de manter dois runtimes em
sincronia supera qualquer ganho da separação, num sistema cujo backend cabe em
~15 endpoints.

O ganho de performance do Astro sobre RSC é real, porém pequeno em valor absoluto —
e o Next.js já atinge os alvos do RNF-01 com folga quando bem configurado.

## Consequências

- Todo o código vive num repositório; `app/(site)` para o público, `app/(admin)`
  para o painel, `app/api` para os handlers.
- O protótipo `index.html` vira **referência visual**, não base de código. A lógica
  de etapas e a geração de `.ics` são reaproveitadas conceitualmente; o CSS vira
  tokens Tailwind (FASE-01).
- Se surgir necessidade de processamento pesado (relatórios, ML), um serviço Python
  pode ser adicionado como worker separado sem tocar no site.
- Fica registrado que **não é** uma crítica ao FastAPI — é uma escolha de topologia
  para esta escala. Com 3+ desenvolvedores ou múltiplas clínicas, a decisão merece
  ser revisitada.
