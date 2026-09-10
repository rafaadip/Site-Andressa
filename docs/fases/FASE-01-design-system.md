# FASE 01 — Design System

> **Objetivo:** transformar a identidade visual já existente (carrossel de
> Nutrologia + retratos) num sistema de tokens verificado, implementável e
> auditável.
> **Depende de:** nada · **Habilita:** FASE-03, FASE-07, FASE-09
> **Estimativa:** 3–4 dias

---

## 1. Leitura da marca

O material fornecido já define a linguagem visual — o trabalho não é *inventar* um
estilo, é **codificá-lo**.

Observado no carrossel:

| Elemento | Leitura |
|---|---|
| Fundo | Marfim quente, levemente rosado — **não** branco puro |
| Contraponto | Marrom espresso profundo, quase preto, usado em bloco cheio |
| Acento | Ouro/bronze fosco — bordas de ícone, fios, palavras em destaque |
| Títulos | Serifa transicional de contraste médio, caixa alta em títulos curtos |
| Corpo | Sans geométrica leve, entrelinha generosa |
| Flourish | Script itálica, usada **uma vez** por peça |
| Fotografia | Luz alta e suave, fundo claro, sem drama |
| Ícones | Linha fina, dentro de círculo em areia clara |
| Espaço | Muito respiro; nenhuma peça chega perto de encher a área |

**Princípio de tradução:** o carrossel é *editorial impresso*. Na web, isso vira
tipografia grande, muito espaço vertical, poucas cores e **nenhuma sombra dramática**.
Sombra pesada é a marca registrada de site genérico de clínica — evitar.

> **Nota da skill `ui-ux-pro-max`:** a consulta `--design-system` sugeriu paletas
> *Teal Modern* / *Ocean Blue* e o padrão *SaaS Dashboard*. Ambos foram
> **descartados**: existe identidade estabelecida, e a recomendação genérica de
> "healthcare = azul/verde-água" é exatamente o clichê que este projeto evita. Já a
> sugestão tipográfica **Playfair Display + sans** e as regras de acessibilidade,
> formulário e movimento do skill foram adotadas integralmente.

---

## 2. Cor

### 2.1 Escala primitiva

```css
@theme {
  /* Marfim — fundos */
  --color-ivory-50:  #FBF8F3;  /* fundo da página */
  --color-ivory-100: #F5EFE5;  /* seção alternada, cartões */
  --color-sand-200:  #E9DDCA;  /* divisórias decorativas, chips */
  --color-sand-300:  #D8C7AC;  /* borda de cartão */
  --color-sand-400:  #A08A68;  /* borda de INPUT (ver §2.3) */

  /* Ouro — acento */
  --color-gold-200:  #EBD9BC;  /* acento sobre fundo escuro */
  --color-gold-400:  #C9A06A;  /* preenchimento de botão */
  --color-gold-500:  #B8874E;  /* fios, ícones — NUNCA texto pequeno em claro */
  --color-gold-700:  #8A6230;  /* TEXTO em ouro sobre marfim */

  /* Espresso — tinta e blocos escuros */
  --color-espresso-700: #463322;
  --color-espresso-800: #33251A;
  --color-espresso-900: #241A13;

  /* Neutros de texto */
  --color-ink:        #241A13;
  --color-ink-muted:  #6B5A4B;
  --color-ink-subtle: #8A7666;  /* decorativo — nunca texto essencial */

  /* Semânticos */
  --color-danger:       #A3271F;
  --color-danger-dark:  #F2B8B5;  /* sobre espresso */
  --color-success:      #2F6B4F;
  --color-success-dark: #A7D7BE;
}
```

### 2.2 Tokens semânticos

Componentes referenciam **só** esta camada. Nenhum hex cru em JSX.

| Token | Claro | Sobre espresso |
|---|---|---|
| `--bg-page` | `ivory-50` | `espresso-900` |
| `--bg-surface` | `ivory-100` | `espresso-800` |
| `--bg-raised` | `#FFFFFF` | `espresso-700` |
| `--text-primary` | `ink` | `ivory-100` |
| `--text-secondary` | `ink-muted` | `#C4B5A3` |
| `--text-accent` | `gold-700` | `gold-200` |
| `--border-subtle` | `sand-200` | `rgb(235 217 188 / .14)` |
| `--border-field` | `sand-400` | `rgb(235 217 188 / .34)` |
| `--focus-ring` | `gold-700` | `gold-200` |

### 2.3 Contraste — verificado, não presumido

Medido em WCAG 2.x sobre `#FBF8F3`:

| Par | Ratio | Texto AA (4,5) | UI/texto grande (3,0) |
|---|---:|:---:|:---:|
| `ink` #241A13 | **16,09** | ✅ | ✅ |
| `ink-muted` #6B5A4B | **6,22** | ✅ | ✅ |
| `ink-subtle` #8A7666 | 4,08 | ❌ | ✅ |
| `gold-500` #B8874E | 3,00 | ❌ | ✅ |
| **`gold-700` #8A6230** | **5,12** | ✅ | ✅ |
| `sand-300` #D8C7AC | 1,56 | ❌ | ❌ |
| **`sand-400` #A08A68** | 3,13 | ❌ | ✅ |
| `danger` #A3271F | 6,91 | ✅ | ✅ |
| `success` #2F6B4F | 5,94 | ✅ | ✅ |

Sobre `espresso-900` #241A13:

| Par | Ratio |
|---|---:|
| `ivory-100` | **14,90** ✅ |
| `#C4B5A3` (secundário) | **8,51** ✅ |
| `gold-400` | **7,08** ✅ |
| `gold-200` | **12,32** ✅ |

**Três consequências que mudam o código:**

1. **O ouro da marca (#B8874E) reprova para texto pequeno em fundo claro** (3,00 <
   4,5). Onde ele hoje é usado como *eyebrow* (`ATENDIMENTO`, `SOBRE A DOUTORA`), o
   token correto é `gold-700` #8A6230 — visualmente quase idêntico, 5,12 de ratio.
   O `gold-500` continua válido em fios, ícones e **preenchimento** de botão.
2. **Borda de input precisa de `sand-400`.** WCAG 2.2 §1.4.11 exige 3:1 para
   contornos de componente. O `rgba(26,34,25,.18)` do protótipo fica em ~1,3 —
   reprova. Bordas *decorativas* (divisórias, cartão) podem seguir claras.
3. **`ink-subtle` é decorativo.** Nunca em label, valor de campo ou aviso.

Script de verificação (roda no CI, FASE-12): `scripts/check-contrast.ts`.

### 2.4 Modo escuro

**Não haverá alternador de tema.** É uma decisão de marca, não uma omissão: a
identidade é marfim quente, e uma inversão automática destruiria o contraponto
espresso que dá o caráter premium. O sistema já opera em **duas superfícies**
(marfim e espresso), que é o contraste que a marca pede.

Consequências obrigatórias:
- `color-scheme: light` no `:root` — impede o dark mode forçado do iOS/Android de
  inverter as cores e arruinar o layout;
- `<meta name="theme-color" content="#FBF8F3">`;
- todas as superfícies pintam fundo **explicitamente** (nunca transparente).

---

## 3. Tipografia

### 3.1 Famílias

| Papel | Fonte | Pesos | Justificativa |
|---|---|---|---|
| Display | **Playfair Display** | 500, 600 | Serifa transicional de alto contraste. Confirmada pela skill (`elegant editorial`) e a mais próxima dos títulos do carrossel |
| Corpo/UI | **Jost** | 300, 400, 500 | Sans geométrica (linhagem Futura) — é a sans do carrossel; harmoniza com a serifa por contraste de classe, não de peso |
| Flourish | **Cormorant Garamond Italic** | 500 | Uma única citação por página. Subset reduzido |

Carregadas com `next/font/local` (WOFF2 self-hosted), `display: 'swap'`,
`preload: true` apenas para Jost 400 e Playfair 600 — as duas que aparecem acima da
dobra.

**Sem Google Fonts CDN:** motivo de LGPD e de LCP (ver ADR-005).

### 3.2 Escala

Fluida com `clamp()`, ancorada em 16 px no mobile. Razão ≈ 1,25 no corpo e ≈ 1,33 no
display.

| Token | Mobile → Desktop | Line-height | Uso |
|---|---|---|---|
| `--text-display` | 40 → 68 px | 1.06 | H1 do hero |
| `--text-h2` | 30 → 44 px | 1.14 | Título de seção |
| `--text-h3` | 22 → 27 px | 1.25 | Cartão, etapa |
| `--text-lead` | 18 → 20 px | 1.6 | Parágrafo de abertura |
| `--text-body` | 16,5 px fixo | **1.65** | Corpo |
| `--text-sm` | 14,5 px | 1.55 | Legenda, ajuda de campo |
| `--text-eyebrow` | 12,5 px | 1.4 | `letter-spacing: .22em`, caixa alta |

```css
--text-display: clamp(2.5rem, 1.6rem + 3.6vw, 4.25rem);
--text-h2:      clamp(1.875rem, 1.35rem + 2.1vw, 2.75rem);
--text-h3:      clamp(1.375rem, 1.2rem + .7vw, 1.6875rem);
--text-lead:    clamp(1.125rem, 1.05rem + .3vw, 1.25rem);
```

**Regras fixas**
- Corpo nunca abaixo de 16 px (iOS dá zoom automático em input < 16 px).
- Medida de linha: 60–75 caracteres no desktop (`max-width: 68ch`), 35–60 no mobile.
- `font-variant-numeric: tabular-nums` em **horários, datas e telefone** — sem isso o
  grid de horários "dança" ao mudar de dia.
- Nunca `letter-spacing` negativo no corpo; só no display, e no máximo `-.015em`.
- Hierarquia por **tamanho e espaço**, não por cor.

---

## 4. Espaço, grid e forma

```css
/* Escala de 4 px */
--space-1: .25rem;  --space-2: .5rem;   --space-3: .75rem;  --space-4: 1rem;
--space-6: 1.5rem;  --space-8: 2rem;    --space-12: 3rem;   --space-16: 4rem;
--space-24: 6rem;   --space-32: 8rem;

/* Ritmo vertical de seção — o respiro é o que faz parecer premium */
--section-y: clamp(4.5rem, 3rem + 7vw, 8rem);

/* Contêiner */
--container: 1140px;
--gutter: clamp(1.25rem, .75rem + 2vw, 2.5rem);  /* nunca < 20 px */

/* Raio — discreto; o premium aqui vem de tipografia, não de cantos redondos */
--radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-pill: 999px;

/* Elevação — quase imperceptível. Nada de sombra "flutuando" */
--shadow-sm: 0 1px 2px rgb(36 26 19 / .04);
--shadow-md: 0 8px 24px -12px rgb(36 26 19 / .12);
--shadow-lg: 0 24px 60px -30px rgb(36 26 19 / .22);

/* Camadas */
--z-base:0; --z-sticky:10; --z-dropdown:20; --z-overlay:40; --z-modal:50; --z-toast:60;
```

Breakpoints: **375 · 768 · 1024 · 1440**. Mobile-first, sem exceção.

---

## 5. Componentes (inventário do MVP)

| Componente | Estados | Nota de acessibilidade |
|---|---|---|
| `Button` (gold / espresso / ghost / link) | default, hover, active, focus, disabled, loading | Alvo ≥ 44×44; `aria-busy` no loading; **nunca** troca de tamanho ao pressionar |
| `Eyebrow` | — | `gold-700`; é decorativo → não substitui heading |
| `SectionHeading` | — | `<h2>` real; nível nunca pulado |
| `Card` | default, hover | Hover só translada 2 px + muda borda (`transform`, não `box-shadow` animado) |
| `DayPicker` | idle, selected, disabled, focus | `role="radiogroup"` + `role="radio"` — **não** `listbox` |
| `TimeSlotGrid` | idle, selected, disabled, loading, empty | Idem; skeleton no loading; estado vazio com ação |
| `Stepper` | current, complete, upcoming | `<ol>` + `aria-current="step"` — **não** `aria-hidden` |
| `Field` (text/tel/email/textarea) | idle, focus, error, disabled, readonly | Label visível; erro abaixo com `aria-describedby` + `role="alert"` |
| `Checkbox` (consentimento) | idem | Alvo 24 px + área clicável no rótulo inteiro |
| `Alert` (info/erro/sucesso) | — | Ícone **e** texto — cor nunca sozinha |
| `Toast` | — | `aria-live="polite"`; não rouba foco; 5 s |
| `Skeleton` | — | `prefers-reduced-motion` desliga o shimmer |
| `MobileNav` | closed, open | Foco preso no aberto; `Esc` fecha; devolve foco ao gatilho |

### 5.1 Foco visível — não negociável

```css
:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}
```

Nunca `outline: none` sem substituto de contraste equivalente.

---

## 6. Movimento

Herda as regras de movimento da skill `ui-ux-pro-max`:

| Regra | Valor |
|---|---|
| Micro-interação | 150–220 ms |
| Transição de etapa | 260–320 ms |
| Saída | ~65 % da entrada |
| Easing entrada | `cubic-bezier(.22,.61,.36,1)` |
| Propriedades | **só** `transform` e `opacity` |
| Elementos animados por vista | máx. 2 |
| Stagger em lista | 30–40 ms/item, teto de 8 itens |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Regra editorial: **movimento precisa significar alguma coisa.** Avançar etapa desliza
para a esquerda; voltar, para a direita. Nada entra só porque "fica bonito".

---

## 7. Iconografia

- **Lucide**, traço 1,5 px, tamanhos `16 / 20 / 24`.
- Importar por ícone (`lucide-react/icons/...`), nunca o pacote inteiro.
- Ícone sozinho **sempre** com `aria-label`; ícone ao lado de texto → `aria-hidden`.
- **Zero emoji** como ícone estrutural.
- Ícones de seção herdam o tratamento do carrossel: traço em `gold-500` dentro de
  círculo `sand-200` de 44 px.

---

## 8. Fotografia

| Uso | Tratamento |
|---|---|
| Retrato do hero | Recorte 3:4, máscara radial suave na base (como no protótipo), AVIF + WebP, `priority` |
| Retrato "Sobre" | 4:5, canto `--radius-lg`, fio `gold-500` deslocado 18 px (detalhe do protótipo — mantém) |
| Ambiente | Reservado para v1.1 |

Todas com `width`/`height` explícitos (CLS) e `alt` descritivo do que importa
clinicamente ("Dra. Andressa Chaves Correia, de jaleco branco, em seu consultório"),
nunca `alt="foto"`.

**Proibido pelo CFM:** imagem de antes/depois, foto de paciente, cena de
procedimento. (FASE-10)

---

## 9. Entregáveis

- [ ] `app/globals.css` com `@theme` completo (primitivos + semânticos)
- [ ] `lib/fonts.ts` com `next/font/local` e subsets
- [ ] `components/ui/*` — inventário do §5 com todos os estados
- [ ] Página `/dev/design-system` (só em `NODE_ENV !== 'production'`) exibindo
      tokens, escala tipográfica e todos os estados de componente
- [ ] `scripts/check-contrast.ts` — falha o build se algum par semântico reprovar
- [ ] `docs/design-tokens.json` — fonte única, exportável para Figma

## 10. Critérios de aceite

- [ ] Nenhum hex cru fora de `globals.css` (checado por lint)
- [ ] Todos os pares de texto ≥ 4,5:1; todas as bordas de campo ≥ 3:1 (script verde)
- [ ] Todo componente interativo tem `:focus-visible` visível a ≥ 3:1
- [ ] Alvos de toque ≥ 44×44 px, espaçamento ≥ 8 px
- [ ] Layout íntegro em 375 px de largura e com fonte do sistema em 200 %
- [ ] `prefers-reduced-motion` remove todas as animações
- [ ] Zero emoji como ícone
