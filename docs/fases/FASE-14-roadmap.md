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

### 2.2 Agenda da médica no iPhone
**Gatilho:** ela pedir para ver os agendamentos no app Calendário do iPhone.
**Contexto:** removido do escopo em 10/09/2026 a pedido do cliente
([ADR-003](../adr/ADR-003-ics-para-o-paciente.md)); a agenda dela é só Google.
**Escopo, se voltar:** feed `webcal://` assinado (~1 dia) — sem credencial da Apple
no servidor, nunca quebra por troca de senha. CalDAV só se ela precisar **editar** o
evento pelo iCloud, e aí com o risco de a senha de app expirar em silêncio.

### 2.3 Lista de espera
**Gatilho:** slots esgotando com mais de 3 semanas de antecedência.
**Escopo:** paciente entra na fila de um dia; cancelamento dispara aviso ao primeiro
da fila, com janela de 2 h para confirmar.
**Valor:** transforma cancelamento em receita, e é o item de melhor retorno da lista.

### 2.4 Ativar SEO local (quando o endereço existir)
**Gatilho:** endereço do consultório definido.
**Escopo:** preencher `PROFISSIONAL.endereco`, criar e verificar o Perfil da Empresa
no Google, acrescentar `streetAddress`/`postalCode` ao JSON-LD, conferir o NAP.
**Valor:** destrava o pacote local — a superfície de busca com maior intenção de
conversão ("nutrólogo perto de mim"). Ver
[FASE-11](FASE-11-seo-performance.md).
**Custo:** ~meio dia de código; a verificação do perfil pode levar dias (o Google
envia código por carta ou vídeo).

### 2.5 Reagendamento em um toque
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
| Endereço do consultório indefinido | Não definido pelo cliente até 10/09/2026 | Site opera em "modo sem endereço" ([FASE-03 §3.1](FASE-03-site-institucional.md)). Preencher um objeto destrava site, `.ics` e JSON-LD; o SEO local segue bloqueado até a verificação do perfil |
| `VTIMEZONE` fixo em UTC−3 | [FASE-06 §2.3](FASE-06-ics-calendario-paciente.md) — o Brasil não tem horário de verão hoje | Se voltar: acrescentar componente `DAYLIGHT` com `RRULE`. `// TODO(dst)` no código |
| **Google como ponto único de falha** | [ADR-003](../adr/ADR-003-ics-para-o-paciente.md) — Apple fora do escopo | Sem segunda via para ler disponibilidade se a API cair. Mitigado pela degradação graciosa da [FASE-05 §6](FASE-05-google-calendar.md), não eliminado |
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
