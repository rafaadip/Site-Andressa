# QA — testes, aparelhos, não funcionais e revisões

> Rodada de 25/09/2026. O que é automatizado, em que camada, contra o quê — e o
> que só um aparelho real prova ([roteiro manual](ROTEIRO-TESTE-MANUAL.md)).
> Segurança tem documento próprio: [SEGURANCA](SEGURANCA.md).

## 1. Pirâmide

| Camada | Onde | Contra o quê | Quantos |
|---|---|---|---|
| Unitários de `lib/` | `tests/unit/` | Funções puras (motor, fuso, `.ics`, validação, PII, TLS, observabilidade) | ⟨UNIT⟩ |
| Componentes React | `tests/componentes/` | jsdom + Testing Library: papel, nome acessível, estado `aria-*` | ⟨COMP⟩ |
| Integração | `tests/integration/` | **Postgres real** (constraint, locks, migrations pelo journal); Google e Resend falsos em memória | ⟨INTEG⟩ |
| Funcionais de API | `tests/integration/api-*.test.ts` | Route handlers chamados com `Request` real: status, cabeçalhos, corpo de erro | ⟨API⟩ |
| E2E | `tests/e2e/` | Build de produção (`next start`), Chromium, axe WCAG 2.2 AA, teclado, fuso de Manaus, 9 aparelhos | 123 |
| Não funcionais | `tests/nao-funcional/` | Build de produção: carga e resiliência com orçamentos | 20 orçamentos |
| Lighthouse CI | `.github/workflows/ci.yml` | Performance, acessibilidade, SEO | no pipeline |

Total automatizado com Vitest: **⟨TOTAL⟩ testes**. Cobertura de `lib/`:
⟨COBERTURA⟩ das linhas (limites no `vitest.config.mts`: 85 % global, 90 % no
motor e no calendário).

## 2. Aparelhos (E2E, `tests/e2e/dispositivos.spec.ts`)

Emulação no Chromium: viewport, densidade de pixels, toque e user agent. Cada
aparelho percorre **4 jornadas** no toque: home (cabe na tela, CTA alcançável),
navegação (menu do celular ou links do desktop), **agendamento completo +
cancelamento pelo link** e painel da médica (barra de navegação no polegar em
< 768 px).

| Aparelho | Área visível (CSS px) | Resultado |
|---|---|---|
| iPhone SE (reflow WCAG) | 320 × 568 @2x | ✅ 4/4 |
| iPhone 15 | 393 × 659 @3x | ✅ 4/4 |
| iPhone 15 Pro Max | 430 × 739 @3x | ✅ 4/4 |
| Galaxy S24 | 360 × 780 @3x | ✅ 4/4 |
| Galaxy S9+ | 320 × 658 @4,5x | ✅ 4/4 |
| Galaxy Tab S4 | 712 × 1138 @2,25x | ✅ 4/4 |
| iPad (7ª) retrato | 810 × 1080 @2x | ✅ 4/4 |
| iPad (7ª) paisagem | 1080 × 810 @2x | ✅ 4/4 |
| Desktop Chrome | 1280 × 720 | ✅ 4/4 |

Mais: matriz de viewports 375–1440 (sem rolagem horizontal), axe em todas as
páginas públicas e do painel, teclado puro, fuso de Manaus.

**Limites da emulação** (ficam para o [roteiro manual](ROTEIRO-TESTE-MANUAL.md)):
motor WebKit do Safari, teclado virtual, barra de endereço que some, área
segura do notch (`env(safe-area-inset-*)` é 0 no Chromium), zoom do iOS em
campo < 16 px (medido pelo `font-size`, não observado), leitor de tela real e
apps de calendário.

## 3. Não funcionais

`npm run build` antes; os scripts sobem o próprio `next start`.

**Carga** (`npm run test:carga`, banco local):

| Orçamento | Medido |
|---|---|
| Páginas: p95 ≤ 800 ms, 0 erro (300 req., 20 simultâneas) | p95 306 ms |
| `/api/disponibilidade`: p95 ≤ 800 ms, 0 erro | p95 281 ms |
| 40 reservas simultâneas no **mesmo** horário | 1 × 201, 39 × 409 |
| … com p95 ≤ 2000 ms | p95 613 ms |
| 20 horários distintos em paralelo | 20 × 201, 0 × 5xx |
| Sobreposição no banco depois da carga | 0 |

**Resiliência** (`npm run test:resiliencia`): banco **recusando** conexão e
banco **pendurado** (servidor TCP que aceita e não responde).

| Orçamento | Recusando | Pendurado |
|---|---|---|
| Home, `/sobre`, privacidade respondem 200 | ≤ 30 ms | ≤ 922 ms |
| `/agendar` cai no WhatsApp | 67 ms | 2,5 s (era 10 s) |
| `/api/health` = 503 `{status:"fora"}` | ✅ | ✅ |
| APIs: erro genérico, sem SQL nem stack | ✅ | ✅ |

## 4. Revisão de UX/UI (9 aparelhos emulados, 97 capturas)

| ID | Sev. | Achado | Correção |
|---|---|---|---|
| UX-01 | Alta | Etapa 1: erro e 2ª opção nasciam atrás da barra fixa "Continuar" | Foco e rolagem até o erro (`lib/scroll-para-vista.ts`, respeita movimento reduzido); espaço inferior; `scroll-padding-bottom` |
| UX-02 | Alta | Painel: "Remarcar" nascia sob a navegação do rodapé | Sombra de continuidade na barra + `scroll-padding-bottom` |
| UX-03 | Média | "Link da sua consulta" com 14,5 px (zoom no iOS) | 16,5 px |
| UX-04 | Baixa | Links "pelo WhatsApp" com 21 px de altura | Alvo de 44 px |
| UX-05 | Baixa | Apagar o motivo (dado de saúde) num toque | Confirmação em 2 etapas, como o cancelamento |
| UX-06 | Sugestão | "Você quis dizer…?" sob a barra fixa | Traz à vista ao aparecer |

Preservado: zero rolagem horizontal em 9/9 aparelhos, zero violação do axe,
grade de 3/4 colunas, bloqueio que nunca cancela em silêncio, tablet como caso
de primeira classe. Regressão: `tests/e2e/ux-regressao.spec.ts`.

## 5. Revisão de código (Clean Code / Clean Arch)

Bugs confirmados por teste e corrigidos (cada um com regressão que falha sem a
correção):

| Bug | Onde | Correção |
|---|---|---|
| Horários fora da grade depois de um compromisso (14:07, 14:37…) | `lib/availability/engine.ts` | `alinharAGrade()` em `lib/datetime.ts` |
| Fim do dia por "+24 h" (dia de 23/25 h) | motor, lembretes, FreeBusy, painel, janela | `fimDoDiaLocal()` |
| Consulta remarcada depois do D-1 nunca recebia o lembrete novo | `lib/notificacoes/lembretes.ts` | Chave do lembrete leva o horário |
| Cron não enviava o que acabara de enfileirar | `lib/notificacoes/fila.ts` | Vencimento com o mesmo `agora` |
| Remarcar durante a sincronização deixava o Google no horário velho | `lib/calendar/sincronizar.ts` | Versão otimista (status, SEQUENCE, motivo, anonimização) |
| "Desconectar" esquecia que a agenda existiu (sem D+2) | `lib/calendar/conexao.ts` | Linha fica como revogada |
| Telefone com dígito a mais truncado em silêncio | `lib/telefone.ts` | Recusado |
| Eliminação com e-mail vazio "eliminava" de novo | `lib/agendamento/admin.ts` | Recusado; só conta o que muda |

Arquitetura, medida no grafo de imports: **nenhum ciclo** em runtime; nenhum
módulo de `lib/` importa `app/` ou `components/`; `components/` só importa de
`lib/` o que é de apresentação (config, conteúdo, validação compartilhada,
fuso do cliente). Clean Code: `criarAgendamento` dividido em etapas nomeadas;
export morto removido. Maior dívida conhecida: `FluxoAgendamento.tsx` (~370
linhas, um componente com as 3 etapas) — coberto por E2E e testes de
componente; dividir por etapa é o próximo refactor.

## 5.1 Bugs encontrados pelos testes novos

⟨BUGS⟩

## 6. Como rodar

```bash
# Postgres local: ver CLAUDE.md
export DATABASE_URL_TEST=postgresql://postgres@127.0.0.1:55432/andressa
npm run verify                      # typecheck, lint, contraste, conformidade, Vitest
npm run test:coverage               # com cobertura
npm run build && npm run test:e2e   # 123 E2E, inclui os 9 aparelhos
npm run test:carga && npm run test:resiliencia
```
