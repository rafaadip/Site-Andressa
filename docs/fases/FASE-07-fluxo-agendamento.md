# FASE 07 — Fluxo de agendamento

> **Objetivo:** a peça que converte. Quatro etapas, sem cadastro, à prova de erro
> e acessível.
> **Depende de:** FASE-01, FASE-04, FASE-05, FASE-06 · **Habilita:** FASE-08
> **Estimativa:** 5 dias
> **Regras aplicadas:** `ui-ux-pro-max` §2 (toque), §8 (formulários), §1 (a11y)
>
> ⚠️ **Esta é a superfície mobile crítica do produto.** A maioria dos pacientes vai
> percorrer este fluxo inteiro no celular, com uma mão. Leia
> [01-MOBILE-FIRST](../01-MOBILE-FIRST.md) antes de implementar.

---

## 1. O fluxo

```
   ①  Modalidade  →  ②  Data e horário  →  ③  Seus dados  →  ✓  Confirmado
```

Por que quatro e não uma página só: cada etapa faz **uma** pergunta, com uma ação
primária. Um formulário único com 8 campos e um calendário assusta no celular — que é
onde a maior parte das pessoas vai marcar.

Por que quatro e não seis: cada etapa a mais é uma chance de abandono. Quatro é o
mínimo que mantém uma pergunta por tela.

### Estado

```ts
type EstadoAgendamento =
  | { etapa: 1; tipo?: TipoConsulta }
  | { etapa: 2; tipo: TipoConsulta; dia?: string; slot?: Slot }
  | { etapa: 3; tipo: TipoConsulta; slot: Slot; dados: Partial<DadosPaciente> }
  | { etapa: 4; agendamento: AgendamentoConfirmado };
```

Union discriminada, não um objeto com tudo opcional: o compilador impede "avançar
para a etapa 3 sem slot".

**Persistência:** `sessionStorage` até a etapa 3 (não `localStorage` — dado de saúde
não fica no dispositivo depois de fechar a aba). Limpa ao confirmar. Recuperar um
rascunho ao voltar por engano é a diferença entre remarcar e desistir.

---

## 2. Etapa 1 — Modalidade

```
┌────────────────────────────────┬────────────────────────────────┐
│  Consulta presencial           │  Teleconsulta                  │
│  Guarulhos – SP · 40 minutos   │  Por vídeo · 30 minutos        │
│                                │  Link enviado após confirmação │
└────────────────────────────────┴────────────────────────────────┘
                                          [ Continuar → ]
```

- **Mobile:** cartões empilhados, largura total, altura mínima 88 px. **Tablet e
  desktop:** lado a lado.
- `role="radiogroup"` com `role="radio"` + `aria-checked`.
- Navegação por setas (roving `tabindex`) — comportamento esperado de radiogroup.
- Cartão inteiro é o alvo (bem acima de 44 px).
- Estado selecionado por **borda + fundo + ícone**, nunca só cor.
- Selecionar **não** avança sozinho: o clique acidental no celular é comum e o
  avanço automático rouba o controle.

---

## 3. Etapa 2 — Data e horário

```
  Fuso: Brasília (America/Sao_Paulo)              [ ← set  |  out → ]

  ┌────┬────┬────┬────┬────┬────┬────┐
  │ seg│ ter│ qua│ qui│ sex│ sáb│ dom│
  │ 15 │ 16 │ 17 │ 18 │ 19 │ 20 │ 21 │
  │ ●● │ ●  │ ─  │ ●●●│ ●  │ ─  │ ─  │   ● = vagas · ─ = sem atendimento
  └────┴────┴────┴────┴────┴────┴────┘

  Segunda, 15 de setembro
  ┌───────┬───────┬───────┬───────┐
  │ 09:00 │ 09:50 │ 14:00 │ 14:50 │
  └───────┴───────┴───────┴───────┘

  [ ← Voltar ]                        [ Continuar → ]
```

### Decisões

| Decisão | Motivo |
|---|---|
| Densidade de vagas no seletor de dia | Evita o "tateio" de clicar dia a dia procurando vaga |
| Fuso sempre visível | Teleconsulta pode ser de outro estado; ambiguidade aqui gera falta |
| Dia sem atendimento aparece **desabilitado**, não some | "Ela não atende quarta" é informação; um buraco no calendário é confusão |
| Slots em grade, não `<select>` | Comparação visual instantânea; alvos de 48 px |
| Grade de 3 col. (celular) → 4 (tablet) → 4–5 (desktop) | Mantém o alvo em 48 px sem apertar |
| Seletor de dia rola na horizontal no celular | 7 dias não cabem em 375 px com alvo de 44 px |
| Botão "Continuar" **sticky no rodapé** no celular | Fica na faixa do polegar e não some ao rolar a grade |
| Skeleton ao carregar | `progressive-loading`: nunca uma grade vazia que parece "sem vagas" |
| Estado vazio com ação | "Sem horários nesta semana. [Ver próxima semana]" |

### Fuso do paciente (teleconsulta)

```
14:00  ·  Brasília
13:00  ·  seu horário (Cuiabá)
```

Só aparece quando `Intl.DateTimeFormat().resolvedOptions().timeZone` difere do fuso
da clínica. Evita o clássico "achei que era no meu horário".

### Barra de ação fixa (celular)

```css
.acoes-etapa {
  position: sticky; bottom: 0;
  padding-block: var(--space-3);
  padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(transparent, var(--bg-page) 30%);
}
@media (min-width: 768px) { .acoes-etapa { position: static; } }
```

O `safe-area-inset-bottom` é obrigatório: sem ele o botão fica sob a barra de gestos
do iPhone. A grade de horários recebe `padding-bottom` equivalente para que o último
slot não fique escondido atrás da barra.

### Acessibilidade — o que corrigir em relação ao protótipo

O `index.html` usa `role="listbox"` num `<div>` cheio de `<button>`s. Isso é
inválido: filhos de `listbox` precisam ser `option`, com `aria-selected` e foco
gerenciado. Leitores de tela anunciam a estrutura errada.

```html
<!-- ✅ -->
<div role="radiogroup" aria-label="Dias disponíveis">
  <button role="radio" aria-checked="true"  tabindex="0"
          aria-label="Segunda-feira, 15 de setembro, 4 horários disponíveis">…</button>
  <button role="radio" aria-checked="false" tabindex="-1"
          aria-label="Terça-feira, 16 de setembro, sem horários" disabled>…</button>
</div>
```

O indicador de etapas também: hoje está `aria-hidden="true"`, o que **esconde o
progresso** de quem usa leitor de tela. Correto:

```html
<ol class="passos">
  <li aria-current="step">1. Modalidade</li>
  <li>2. Data e horário</li>
  <li>3. Seus dados</li>
</ol>
```

Ao trocar de etapa, foco vai para o `<h2>` da nova etapa (`tabIndex={-1}`), e um
`aria-live="polite"` anuncia *"Etapa 2 de 3: data e horário"*.

---

## 4. Etapa 3 — Dados

```
  ┌─────────────────────────────────────────────────────┐
  │ Consulta presencial · seg, 15 de set às 14:00       │  ← resumo fixo
  └─────────────────────────────────────────────────────┘

  Nome completo *          [________________________]
  Telefone / WhatsApp *    [(11) 9 ____-____       ]
  E-mail *                 [________________________]

  Motivo da consulta (opcional)
  [                                                  ]
  ⓘ Campo opcional. Ajuda a médica a se preparar.

  ☐ Autorizo o uso dos meus dados para agendar e
    confirmar esta consulta. (obrigatório)
  ☐ Autorizo registrar o motivo informado acima, que é
    informação de saúde. (só se preenchido)

  [ ← Voltar ]                    [ Confirmar agendamento ]
```

### Campos

| Campo | Tipo | `autocomplete` | Validação |
|---|---|---|---|
| Nome | `text` | `name` | ≥ 2 palavras, ≥ 5 caracteres |
| Telefone | `tel` | `tel-national` | Máscara BR; 10 ou 11 dígitos; DDD válido |
| E-mail | `email` | `email` | Zod `.email()`; alerta em domínio suspeito (`gmial.com`) |
| Motivo | `textarea` | — | Opcional, ≤ 500 caracteres |

`inputMode` correto (`tel`, `email`) para abrir o teclado certo no celular.

**Regras de campo no celular** (detalhe em [01-MOBILE-FIRST §7](../01-MOBILE-FIRST.md)):

| Regra | Motivo |
|---|---|
| `font-size` ≥ 16 px | Abaixo disso o iOS dá **zoom automático** e o layout salta |
| Altura ≥ 48 px | Alvo de toque |
| Label **acima** do campo, sempre visível | O teclado cobre metade da tela; label flutuante desaparece |
| `scrollIntoView({ block: 'center' })` ao focar | Mantém o campo visível com o teclado aberto |
| Erro **acima** do campo quando ele está na metade inferior | Abaixo ficaria atrás do teclado |
| Um campo por linha até 768 px | Dois campos lado a lado em 375 px reduzem o alvo |

### Consentimento — dois checkboxes, não um

Distinção jurídica, não capricho: dados cadastrais (nome, telefone, e-mail) têm base
legal em execução de contrato; o **motivo da consulta é dado de saúde** e o Art. 11
da LGPD exige consentimento **específico e destacado**. Um checkbox único que
mistura os dois não é específico.

O segundo checkbox só aparece quando há texto no campo de motivo — dispensa
progressiva, e evita pedir consentimento para algo que não vai acontecer.

Registramos `consent_lgpd_at`, `consent_health_at` e `consent_ip_hash`
(SHA-256(ip + salt) — prova de consentimento sem guardar IP).

### Validação (regras da skill §8)

- **`inline-validation`:** valida no `blur`, não a cada tecla. Validar enquanto digita
  mostra "e-mail inválido" no terceiro caractere — hostil.
- **`error-placement`:** mensagem abaixo do campo, ligada por `aria-describedby`,
  com `role="alert"`.
- **`error-clarity`:** causa **e** correção. ❌ "Telefone inválido" → ✅ "Informe o
  telefone com DDD, ex.: (11) 99805-3826".
- **`focus-management`:** ao falhar o envio, foco vai para o primeiro campo inválido.
- **`loading-buttons`:** botão desabilitado com `aria-busy` durante o POST.
- Botão **nunca** fica desabilitado por validação pendente: desabilitar esconde o
  motivo. Fica ativo, e o clique revela o que falta.

---

## 5. Confirmação — o caminho crítico

```ts
POST /api/agendamentos
Headers: { 'Idempotency-Key': <uuid gerado no cliente ao entrar na etapa 3> }
```

Sequência detalhada em [00-ARQUITETURA §8.2](../00-ARQUITETURA.md#82-confirmação-o-caminho-crítico).

### Tratamento de erro na interface

| Resposta | O que o paciente vê |
|---|---|
| `201` | Etapa 4 (sucesso) |
| `409 SLOT_INDISPONIVEL` | Volta à etapa 2 **com os dados preservados**, slots recarregados, alerta: *"Esse horário acabou de ser reservado. Escolha outro — seus dados foram mantidos."* |
| `422` | Erros por campo, foco no primeiro |
| `429` | *"Muitas tentativas. Aguarde um minuto."* |
| `5xx` / rede | *"Não conseguimos concluir. Tente de novo ou fale pelo WhatsApp."* + botão de repetir com a **mesma** `Idempotency-Key` |

O 409 é o caso que separa produto bom de produto ruim. Perder os dados digitados
depois de escolher um horário disputado é a forma mais rápida de perder o paciente.

---

## 6. Etapa 4 — Sucesso

```
              ✓
     Consulta confirmada

  Segunda, 15 de setembro às 14:00
  Consulta presencial · Guarulhos – SP

  ┌────────────────────────────────────┐
  │  Adicionar ao seu calendário       │
  │  [ Apple / Outlook ]  [ Google ]   │
  └────────────────────────────────────┘

  Enviamos os detalhes para
  ana@exemplo.com

  [ Confirmar pelo WhatsApp ]

  Precisa remarcar? Use o link do e-mail
  ou fale pelo WhatsApp.
```

- Os botões de calendário funcionam **na hora**, sem depender do e-mail (FASE-06 §3).
- O `.ics` é gerado no servidor, mas a URL é entregue no `201` — o paciente sai com o
  compromisso mesmo se o e-mail atrasar.
- WhatsApp com mensagem pré-preenchida (herda a boa ideia do protótipo).
- Sem confete, sem animação exagerada: é uma consulta médica.

---

## 7. Gestão sem login — `/consulta/[token]`

Link no e-mail: `/consulta/<token>` — 32 bytes, comparado por **hash em tempo
constante**, válido por 90 dias.

Permite: ver detalhes · **remarcar** (volta à etapa 2 com o slot atual liberado
temporariamente) · **cancelar** (com confirmação) · baixar o `.ics` de novo.

Cancelar dispara: `status='cancelled'` → `.ics` `METHOD:CANCEL` (`SEQUENCE+1`) →
remoção do evento no Google → e-mail para o paciente → notificação para a médica →
`revalidateTag('disponibilidade')`.

Política: remarcar/cancelar até **24 h antes**. Depois disso, só WhatsApp — a tela
explica e oferece o link direto.

---

## 8. Entregáveis

- [ ] `components/agendamento/*` — Stepper, SeletorModalidade, SeletorDia,
      GradeHorarios, FormDados, TelaSucesso
- [ ] `app/api/agendamentos/route.ts` — POST com idempotência e rate limit
- [ ] `app/api/agendamentos/[id]/route.ts` — PATCH (remarcar), DELETE (cancelar)
- [ ] `app/(site)/consulta/[token]/page.tsx`
- [ ] `lib/validation/schemas.ts` — Zod compartilhado
- [ ] Máscara de telefone BR com validação de DDD

## 9. Critérios de aceite

**Funcional**
- [ ] Fluxo completo em ≤ 6 toques a partir do CTA do hero
- [ ] Voltar preserva tudo o que já foi preenchido
- [ ] 20 POSTs concorrentes no mesmo slot → exatamente **um** 201, dezenove 409
- [ ] Repetir o POST com a mesma `Idempotency-Key` não duplica
- [ ] Reserva `held` abandonada libera o horário em 10 min

**Mobile (uso primário)**
- [ ] Fluxo completo percorrido **com uma mão** em aparelho real de 375 px
- [ ] Botão de avançar sempre alcançável, com `safe-area-inset-bottom`
- [ ] Nenhum campo provoca zoom automático no iOS ao receber foco
- [ ] Campo focado visível com o teclado aberto, nas quatro etapas
- [ ] Grade de horários usável em 375 px sem rolagem horizontal
- [ ] Verificado em 375 / 393 / 430 / 768 / 1024, retrato e paisagem

**Acessibilidade**
- [ ] Fluxo inteiro operável só por teclado
- [ ] Anúncio de mudança de etapa em VoiceOver e NVDA
- [ ] Nenhum `role` inválido (`radiogroup`, não `listbox`)
- [ ] Erros anunciados por `role="alert"`
- [ ] Alvos ≥ 44×44 px com ≥ 8 px de espaço
- [ ] Texto do sistema em 200 % não quebra o layout
- [ ] `axe-core` limpo nas quatro etapas

**Privacidade**
- [ ] Motivo da consulta é opcional e tem consentimento próprio
- [ ] Nada de dado de saúde em `localStorage`
- [ ] Consentimento registrado com data/hora e hash de IP
