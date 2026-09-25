# Site Dra. Andressa Chaves Correia

Site profissional com **agendamento online** sincronizado com o **Google Agenda**,
e-mails de confirmação e lembrete, e **painel** para a médica operar a agenda
pelo celular. Premium, minimalista, **mobile-first** — o uso primário é celular
e tablet.

## 📖 Documentação

**→ [`docs/DOCUMENTACAO.md`](docs/DOCUMENTACAO.md)** — comece por aqui.
**→ [`docs/OPERACAO.md`](docs/OPERACAO.md)** — colocar no ar e operar.

| | |
|---|---|
| [Arquitetura](docs/00-ARQUITETURA.md) | Requisitos, stack, modelo de dados, fluxos |
| [Mobile-first](docs/01-MOBILE-FIRST.md) | Padrão obrigatório — celular e tablet como caso primário |
| [Decisões (ADR)](docs/adr/) | 6 registros de decisão arquitetural |
| [Fases](docs/fases/) | 14 fases de desenvolvimento |
| [RIPD](docs/RIPD.md) | Relatório de impacto à proteção de dados (LGPD) |
| [Perfil da Empresa no Google](docs/GUIA-PERFIL-EMPRESA-GOOGLE.md) | Guia para a médica (SEO local) |

## Estado

✅ **Implementação concluída (fases 01–13).** A fase 14 é o roadmap pós-lançamento.

| Para o paciente | Para a médica (`/admin`) |
|---|---|
| Agendamento em 3 passos, sem cadastro | Agenda do dia, telefone e WhatsApp a um toque |
| Só horários realmente livres (regras − plantões do Google − consultas) | Remarcar, cancelar com recado, marcar falta |
| Convite para Apple/Google/Outlook (`.ics`) | "Bloquear o resto de hoje" em um toque |
| E-mail de confirmação, lembrete na véspera e 2 h antes | Semana padrão, bloqueios e horários extras |
| Cancelar pelo link até o prazo; apagar o motivo (LGPD) | Integrações, políticas, direitos do titular (LGPD) |

Garantias verificadas por teste: **sem overbooking** (constraint no banco,
20 requisições simultâneas → 1 vence), fuso por IANA (nunca offset fixo),
falha do Google/e-mail nunca perde consulta, nada de dado de saúde em log,
CSP estrita, WCAG 2.2 AA (axe) em 375 px.

**Falta para o go-live** (não é código): endereço do consultório, horários
reais, domínio e DNS do e-mail, revisão jurídica e teste em aparelho real —
checklist em [`docs/OPERACAO.md` §5](docs/OPERACAO.md).

## Comandos

```bash
npm run dev          # desenvolvimento
npm run verify       # typecheck + lint + contraste + conformidade CFM/LGPD + testes
npm run build && npm run test:e2e   # E2E contra o build de produção
```

Detalhes (Postgres local, variáveis de ambiente) em [`CLAUDE.md`](CLAUDE.md).
