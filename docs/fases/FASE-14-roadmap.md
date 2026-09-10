# FASE 14 — Roadmap pós-lançamento

> **Objetivo:** registrar o que ficou fora do MVP, por quê, e qual sinal justifica
> trazer cada item para dentro.

---

## 1. Princípio

Cada item abaixo foi **deliberadamente** deixado de fora. O gatilho listado é a
condição que torna o item necessário — antes disso, construir é desperdício.

---

## 2. v1.1 — primeiros 3 meses

### 2.1 Lembretes por WhatsApp
**Gatilho:** taxa de falta acima de 10 %.
**Escopo:** WhatsApp Business Cloud API, templates *Utility* aprovados pela Meta,
número dedicado (não o pessoal), opt-in registrado.
**Atenção:** aprovação de template leva dias; cobrança por conversa; opt-in é
exigência da Meta **e** da LGPD.

### 2.2 CalDAV para iCloud
**Gatilho:** ela pedir evento nativo e editável no iPhone.
**Escopo:** [FASE-06 §4.2](FASE-06-apple-ics-caldav.md). Só se o feed `webcal://`
não bastar.
**Risco:** senha de app quebra em silêncio quando ela troca a senha do Apple ID.

### 2.3 Lista de espera
**Gatilho:** slots esgotando com mais de 3 semanas de antecedência.
**Escopo:** paciente entra na fila de um dia; cancelamento dispara aviso ao primeiro
da fila, com janela de 2 h para confirmar.
**Valor:** transforma cancelamento em receita, e é o item de melhor retorno da lista.

### 2.4 Reagendamento em um toque
**Gatilho:** volume de remarcações por WhatsApp.
**Escopo:** no link de gestão, sugerir três horários próximos.

---

## 3. v1.2 — 3 a 6 meses

### 3.1 Conteúdo / blog
**Gatilho:** querer tráfego orgânico além da busca local.
**Escopo:** MDX, `Article` no JSON-LD, 1–2 textos por mês.
**Atenção:** conteúdo médico tem as mesmas restrições de publicidade da FASE-10.
Precisa de revisão a cada texto — o custo real é editorial, não técnico.

### 3.2 Retornos vinculados
**Gatilho:** ela pedir "marcar retorno em 30 dias" no fim da consulta.
**Escopo:** no `/admin`, agendar retorno já ligado à consulta anterior.

### 3.3 Múltiplos locais
**Gatilho:** segundo consultório.
**Escopo:** `location` como entidade; regras de disponibilidade por local; endereço
no `.ics` e no mapa.

### 3.4 Painel de métricas
**Gatilho:** curiosidade dela sobre padrões de agenda.
**Escopo:** taxa de conversão, faltas por dia da semana, horários mais procurados —
tudo agregado, nada individual.

---

## 4. Avaliar, não prometer

| Item | Por que está aqui, e não no roadmap |
|---|---|
| Pagamento online | Restrições de publicidade médica sobre preço; obrigação de estorno; conflito com o não-objetivo de faturamento |
| Prontuário / evolução | Traria o sistema para o alcance das normas de prontuário eletrônico e certificação SBIS-CFM. Mudança de categoria de produto, não de funcionalidade |
| Upload de exames | Dado sensível em volume; exigiria criptografia em repouso por arquivo, controle de acesso e retenção própria |
| App nativo | O site responsivo cobre o caso de uso; PWA resolve o "ícone na tela inicial" com uma fração do custo |
| Chatbot de triagem | Triagem é ato médico; risco ético e de responsabilidade civil |
| Integração com convênio | Cada operadora tem API própria (quando tem) |
| Multi-idioma | Sem demanda observada |

---

## 5. Dívida técnica conhecida

Registrada no momento em que foi assumida, com o custo de resolver:

| Item | Origem | Custo |
|---|---|---|
| `VTIMEZONE` fixo em UTC−3 | [FASE-06 §2.3](FASE-06-apple-ics-caldav.md) — o Brasil não tem horário de verão hoje | Se voltar: acrescentar componente `DAYLIGHT` com `RRULE`. `// TODO(dst)` no código |
| Modelo de um profissional | `practitioner_id` existe, mas não há UI | ~3 dias para expor |
| Buffers embutidos em `starts_at`/`ends_at` | [ADR-004](../adr/ADR-004-antioverbooking.md) — simplifica a constraint | Separar exigiria repensar a exclusão |
| App OAuth em modo *Testing* | [FASE-05 §1](FASE-05-google-calendar.md) — evita verificação do Google | Se o token expirar em 7 dias: publicar e verificar, ou migrar para Workspace |
| Sem fila de mensagens | Cron + `sync_state` bastam neste volume | Acima de ~200 agendamentos/semana, avaliar fila real |

---

## 6. Revisões periódicas

| Quando | O quê |
|---|---|
| Mensal | Fila de sincronização, bounces, Core Web Vitals |
| Trimestral | Dependências, escopos OAuth, resoluções do CFM |
| **Julho de 2027** | **Conclusão da pós-graduação — reavaliar o título profissional (FASE-10)** |
| Anual | Restauração de backup, revisão da política de privacidade, auditoria de acessibilidade |

O item de julho de 2027 é o único com data marcada: quando o RQE sair, basta
preencher `PROFISSIONAL.rqe` em `lib/config.ts` e o site inteiro passa a exibir o
título correto — desde que ninguém tenha escrito o título à mão em outro lugar.
