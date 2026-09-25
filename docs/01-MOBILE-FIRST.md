# Mobile-first — padrão obrigatório

> **A utilização primária do site será por celular e tablet.** Este não é um
> requisito de compatibilidade ("também funciona no celular") — é a **premissa de
> projeto**. O desktop é o caso derivado.
>
> Documento transversal: vale para todas as fases. Referenciado por
> [FASE-01](fases/FASE-01-design-system.md), [FASE-03](fases/FASE-03-site-institucional.md),
> [FASE-07](fases/FASE-07-fluxo-agendamento.md), [FASE-09](fases/FASE-09-painel-admin.md),
> [FASE-11](fases/FASE-11-seo-performance.md) e [FASE-12](fases/FASE-12-qa-acessibilidade.md).

---

## 1. O que muda quando o celular é o caso primário

Não é uma questão de "adaptar o layout". Seis coisas mudam de fato:

| | Abordagem desktop-first (❌) | Mobile-first (✅) |
|---|---|---|
| **Ordem de trabalho** | Desenha em 1440, comprime depois | Desenha em **375**, expande depois |
| **Conteúdo** | Tudo cabe; esconde no mobile | Só o essencial; **acrescenta** no desktop |
| **Interação** | Hover revela informação | Hover **não existe**; tudo por toque |
| **Alvo de toque** | 24–32 px basta para mouse | **≥ 44 px**, com 8 px de folga |
| **Performance** | Wi-Fi, máquina potente | **4G, aparelho mediano** |
| **Aprovação** | "Está bonito no monitor" | **Testado no aparelho, na mão** |

**Consequência prática:** nenhuma tela é considerada pronta antes de ser aprovada em
375 px. O mockup de desktop não aprova nada sozinho.

---

## 2. Breakpoints

```css
/* Mobile-first: a base é o celular; media queries só ADICIONAM */
/* base            0–767   celular (projetar em 375) */
@media (min-width: 768px)  { /* tablet retrato */ }
@media (min-width: 1024px) { /* tablet paisagem / laptop pequeno */ }
@media (min-width: 1440px) { /* desktop */ }
```

**Nunca** usar `max-width` como estratégia principal. `max-width` é o padrão
desktop-first disfarçado: obriga a desfazer estilos em vez de construí-los.

### Larguras de referência para teste

| Aparelho | Largura | Por que importa |
|---|---|---|
| iPhone SE | **375** | O menor em uso relevante. **Se funciona aqui, funciona em tudo** |
| iPhone 15/16 | 393 | O mais comum |
| iPhone Pro Max | 430 | Alcance do polegar é o desafio |
| iPad retrato | **768** | Onde layouts de 2 colunas começam |
| iPad paisagem | 1024 | Frequentemente esquecido |
| iPad Pro | 1366 | Precisa parecer intencional, não "desktop esticado" |

---

## 3. Tablet — nem celular esticado, nem desktop encolhido

O erro mais comum em site responsivo é o tablet cair num limbo: ou uma coluna gigante
com 900 px de medida de linha (ilegível), ou um layout de desktop apertado.

Regras específicas de tablet:

| Elemento | Celular (<768) | **Tablet (768–1023)** | Desktop (≥1024) |
|---|---|---|---|
| Contêiner | 100 % − 40 px | **máx. 680 px, centrado** | máx. 1140 px |
| Medida de linha | 35–60 car. | **60–70 car.** | 60–75 car. |
| Cartões de modalidade | 1 coluna | **2 colunas** | 3 colunas |
| Hero | Empilhado | **Empilhado, foto maior** | 2 colunas |
| Grade de horários | 3 col. | **4 col.** | 4–5 col. |
| Seletor de dia | Rolagem horizontal | **7 dias visíveis** | 7 dias + navegação |
| `--section-y` | 4,5 rem | **6 rem** | 8 rem |

**Paisagem em tablet é caso de primeira classe**, não exceção: muita gente usa iPad
com teclado. Testar as duas orientações.

---

## 4. Toque

### Alvos

```css
/* Mínimo absoluto, sem exceção */
:where(button, a, input, select, [role="radio"], [role="button"]) {
  min-height: 44px;
  min-inline-size: 44px;
}
```

- **44×44 px** é o piso (Apple HIG). WCAG 2.2 §2.5.8 exige 24×24 — usamos 44 com
  folga deliberada.
- **≥ 8 px** entre alvos adjacentes.
- Ícone menor que 44 px → aumentar a área clicável com padding, não o ícone.
- `touch-action: manipulation` para eliminar o atraso de 300 ms.

### Hover não existe

```css
/* ❌ informação só no hover — invisível no celular */
.card:hover .detalhe { opacity: 1; }

/* ✅ visível sempre; hover só realça */
.detalhe { opacity: 1; }
@media (hover: hover) and (pointer: fine) {
  .card:hover { transform: translateY(-2px); }
}
```

Toda informação essencial visível sem interação. `@media (hover: hover)` protege o
realce de aparecer como estado "grudado" após o toque.

### Feedback

Resposta visual em **≤ 100 ms** ao toque — `:active` com opacidade ou escala sutil
(0,97). Sem isso, a pessoa toca de novo, e o duplo toque vira duplo agendamento.

---

## 5. Alcance do polegar

Em telas grandes (≥ 390 px), o topo é difícil de alcançar com uma mão.

```
┌─────────────────┐
│  DIFÍCIL        │  ← informação, títulos
│                 │
├─────────────────┤
│  CONFORTÁVEL    │  ← conteúdo interativo
│                 │
├─────────────────┤
│  FÁCIL          │  ← AÇÃO PRIMÁRIA
└─────────────────┘
```

Regras:
- Ação primária de cada etapa do agendamento fica na **faixa inferior**.
- No mobile, o botão "Continuar" é **sticky no rodapé** durante o fluxo — não some
  ao rolar.
- Nada de ação destrutiva perto de ação frequente.
- Menu no topo é aceitável (é ocasional); botão de confirmar, não.

---

## 6. Áreas seguras e barras do sistema

```css
:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
.rodape-sticky {
  padding-bottom: calc(var(--space-4) + var(--safe-bottom));
}
```

- `viewport-fit=cover` no `<meta viewport>` para o notch/Dynamic Island.
- Barra inferior sticky **sempre** com `safe-area-inset-bottom` — sem isso, o botão
  fica sob a barra de gestos do iPhone.
- Header sticky exige `scroll-margin-top` nos alvos de foco, senão ele **cobre o
  campo focado** ao navegar por Tab (WCAG 2.2 §2.4.11).

---

## 7. Viewport e formulários

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover">
```

**Nunca** `user-scalable=no` nem `maximum-scale=1` — impedir zoom é violação de
acessibilidade.

### Altura

```css
.tela-cheia { min-height: 100vh; min-height: 100dvh; }
```

`100vh` no iOS Safari inclui a barra de endereço, que some ao rolar — o conteúdo fica
cortado. `100dvh` (dynamic viewport height) resolve; `100vh` fica como fallback.

### Campos

| Regra | Motivo |
|---|---|
| `font-size` **≥ 16 px** | Abaixo disso o iOS dá **zoom automático** ao focar, e o layout salta |
| `inputMode`/`type` corretos | `tel` abre teclado numérico; `email` traz `@` |
| `autocomplete` correto | Preenchimento automático em um toque |
| Altura ≥ 48 px | Alvo de toque |
| Label **acima**, sempre visível | O teclado cobre metade da tela; label flutuante some |

### O teclado cobre a tela

Ao focar um campo, ~50 % da tela vira teclado. Consequências:
- Rolar o campo focado para a área visível (`scrollIntoView({ block: 'center' })`).
- Mensagem de erro **acima** do campo quando ele está na metade inferior.
- Botão de envio nunca fica escondido atrás do teclado.

---

## 8. Performance no 4G

O público chega por celular em rede móvel. Alvos do
[FASE-11](fases/FASE-11-seo-performance.md), medidos **em Lighthouse mobile com 4G
simulado** — nunca em desktop.

| Métrica | Alvo |
|---|---|
| LCP | ≤ 1,8 s |
| INP | ≤ 150 ms |
| CLS | ≤ 0,03 |
| JS na home | ≤ 90 kB gzip |

- Imagens com `sizes` correto — mandar 1440 px de foto para tela de 375 é desperdiçar
  ~80 % dos bytes.
- Fontes self-hosted, subset, `display: swap`.
- Sem script de terceiro no carregamento inicial.

---

## 9. Sem rolagem horizontal — nunca

```css
html, body { overflow-x: clip; }   /* rede de segurança, não solução */
```

Causas usuais: `width: 100vw` (inclui a barra de rolagem), `min-width` fixo, tabela
sem contêiner, imagem sem `max-width: 100%`, palavra longa sem `overflow-wrap`.

Tabelas, diagramas e blocos de código podem passar da largura — **cada um dentro do
próprio** `overflow-x: auto`. O corpo da página, nunca.

---

## 10. Checklist — toda tela, antes de considerar pronta

**Layout**
- [ ] Sem rolagem horizontal em 375 px
- [ ] Legível e operável em 768 e 1024, retrato **e** paisagem
- [ ] Gutter ≥ 20 px em qualquer largura
- [ ] Medida de linha dentro da faixa do §3
- [ ] Nada escondido atrás de header ou rodapé sticky

**Toque**
- [ ] Todo alvo ≥ 44×44 px, com ≥ 8 px de folga
- [ ] Nenhuma informação essencial só no hover
- [ ] Feedback visual em ≤ 100 ms
- [ ] Ação primária na faixa de alcance do polegar

**Formulário**
- [ ] Campos com `font-size` ≥ 16 px (sem zoom automático no iOS)
- [ ] Teclado correto por campo (`inputMode`/`type`)
- [ ] Campo focado visível com o teclado aberto
- [ ] Labels visíveis, acima do campo

**Sistema**
- [ ] `safe-area-inset` aplicado em elementos fixos
- [ ] `100dvh` no lugar de `100vh`
- [ ] Zoom do navegador **não** bloqueado
- [ ] Layout íntegro com texto do sistema em 200 %

**Verificação**
- [ ] Testado em **aparelho real**, não só no DevTools
- [ ] Testado com uma mão só
- [ ] Testado em 4G real ou throttling
