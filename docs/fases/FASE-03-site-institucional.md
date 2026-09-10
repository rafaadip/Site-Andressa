# FASE 03 — Site institucional

> **Objetivo:** as páginas públicas — premium, minimalistas, em conformidade com o
> CFM e prontas para busca local.
> **Depende de:** FASE-01, FASE-02 · **Habilita:** FASE-11
> **Estimativa:** 4–5 dias
>
> ⚠️ Uso primário é celular e tablet — [01-MOBILE-FIRST](../01-MOBILE-FIRST.md).
> Cada seção abaixo é desenhada primeiro em 375 px.

---

## 1. Arquitetura de informação

Minimalismo aqui não é "menos conteúdo" — é **menos caminhos**. Uma home em rolagem
longa, um destino de conversão, e nada mais competindo.

```
/                         Home (rolagem longa)
  ├─ Hero
  ├─ Credenciais           (faixa)
  ├─ Sobre
  ├─ Como é a consulta     (as 3 modalidades)
  ├─ O que é Nutrologia    (conteúdo do carrossel)
  ├─ Agendamento           (widget embutido — FASE-07)
  ├─ Perguntas frequentes
  └─ Contato + aviso de urgência
/agendar                  Agendamento em página cheia (mesmo componente)
/sobre                    Trajetória completa (a partir do currículo)
/consulta/[token]         Gerir agendamento (sem login)
/politica-de-privacidade
/termos-de-uso
```

Navegação: **4 itens no máximo** — `Sobre · Atendimento · Contato` + botão
`Agendar consulta`. Um CTA primário por vista.

---

## 2. Seções

### 2.1 Hero

```
┌──────────────────────────────────────────────────────┐
│  NUTROLOGIA · GUARULHOS – SP          [eyebrow ouro] │
│                                                      │
│  Medicina com escuta,          ┌──────────────┐      │
│  tempo e cuidado.              │              │      │
│  ────────────                  │   retrato    │      │
│  [Playfair 600, "cuidado"      │   3:4        │      │
│   em itálico ouro]             │              │      │
│                                │              │      │
│  Consultas presenciais e por   └──────────────┘      │
│  teleconsulta. Escolha o horário                     │
│  e receba a confirmação no seu calendário.           │
│                                                      │
│  [ Agendar consulta ]  [ Conhecer a doutora ]        │
└──────────────────────────────────────────────────────┘
```

- Fundo **espresso-900**, texto marfim (14,9:1). O bloco escuro no topo é a
  assinatura visual do carrossel.
- Monograma em ouro a 7 % de opacidade, sangrando pela borda inferior esquerda.
- Retrato com máscara radial (herdado do protótipo — funciona bem).
- H1 ≤ 8 palavras. Uma palavra em itálico `gold-200`.
- **LCP = o retrato.** `priority`, AVIF+WebP, `sizes` correto, dimensões explícitas.
**Comportamento por faixa:**

| | Celular (<768) | Tablet (768–1023) | Desktop (≥1024) |
|---|---|---|---|
| Layout | Empilhado: texto → foto | Empilhado, foto maior | 2 colunas |
| Altura do retrato | máx. **50 dvh** | 60 dvh | 600 px |
| CTAs | **Largura total, empilhados** | Lado a lado | Lado a lado |
| H1 | 40 px | 52 px | 68 px |

No celular, os dois CTAs ocupam a largura toda e ficam **acima da dobra** junto com o
H1 — o retrato entra depois. Quem chega pelo Instagram no celular precisa ver
"Agendar consulta" sem rolar.

### 2.2 Credenciais

Grade de 4 itens sobre `ivory-100`, marcador em `gold-500`.
**1 coluna no celular · 2 no tablet · 4 no desktop.**

| Item | Texto |
|---|---|
| Registro | **CRM-SP 267.777** · Registro ativo |
| Formação | **Medicina — UNINOVE** · 2019–2024 |
| Pós-graduação | **Nutrologia — Afya** · em curso |
| Certificação | **ACLS** · Suporte avançado de vida |

> ⚠️ "Pós-graduação **em curso**" é redação obrigatória enquanto não houver RQE.
> Ver [FASE-10](FASE-10-compliance-lgpd-cfm.md).

### 2.3 Sobre

Foto 4:5 + texto. **Empilhado até 1023 px** (foto primeiro), duas colunas a partir
de 1024. No tablet a foto fica com largura máxima de 420 px e centrada — esticá-la
para 680 px domina a tela e some com o texto.

Conteúdo derivado do currículo:

> Médica formada pela Universidade Nove de Julho (UNINOVE), com atuação em urgência
> e emergência na rede hospitalar de Guarulhos e São Paulo — UPA Taboão, Complexo
> Hospitalar Padre Bento e Hospital Keila Ferreira.
>
> A formação em pronto atendimento — estabilização de pacientes, análise de
> eletrocardiograma, condutas de emergência — moldou uma leitura clínica que hoje
> aplica ao cuidado longitudinal, em pós-graduação em Nutrologia pela Afya.

Citação em Cormorant itálico, fio `gold-500` à esquerda:

> "Cada paciente chega com uma história. O meu trabalho começa em ouvi-la com
> atenção."

Lista de fatos: Liga de Alergia e Imunologia (diretoria, 2021–2023) · Centro
Acadêmico Rebeca Boltes Cecatto (financeiro, 2022–2023) · Internato na Santa Casa de
SP e no Hospital Geral de Guarulhos.

### 2.4 Como é a consulta

Três cartões sobre **espresso-900** (contraponto do carrossel).
**1 coluna no celular · 2 no tablet (o terceiro ocupa a linha inteira) · 3 no
desktop.**

| Cartão | Conteúdo | Etiqueta |
|---|---|---|
| Consulta em Nutrologia | História clínica, hábitos, rotina, sono, composição corporal e exames — plano individualizado e realista | Presencial · Guarulhos |
| Teleconsulta | Vídeo, nos termos da Resolução CFM de telemedicina. Orientações, retornos e resultados de exames | Online |
| Acompanhamento | Reavaliação periódica, ajuste de conduta e continuidade do plano | Presencial ou online |

**Sem preço.** Decisão de conformidade, não de marketing (FASE-10).

### 2.5 O que é Nutrologia

Aproveita o carrossel — o conteúdo já existe e é bom. Uma linha do tempo vertical
sóbria:

1. **História clínica** — a base do plano
2. **Composição corporal** — além do número da balança
3. **Alimentação** — equilíbrio e viabilidade, não regra
4. **Além da alimentação** — sono, atividade física, estresse, comportamento

Fecho: *"Nutrologia é olhar para o paciente como um todo."* — bloco espresso,
`gold-200`.

Ícones Lucide (traço 1,5) em círculo `sand-200` de 44 px, como no carrossel.

### 2.6 FAQ

`<details>`/`<summary>` nativos — acessíveis, sem JS, e alimentam o rich result de
FAQ (FASE-11).

1. Como funciona a primeira consulta?
2. Preciso levar exames?
3. A teleconsulta tem a mesma validade da presencial?
4. Como recebo o horário no meu celular?
5. Posso remarcar ou cancelar?
6. Atende convênio?
7. Em quanto tempo recebo retorno?

### 2.7 Contato + urgência

Três itens: WhatsApp, e-mail e local. O local usa `localConsulta()` (§3.1) — hoje
sem endereço:

```
CONSULTÓRIO
Guarulhos – SP
Endereço enviado na confirmação da consulta.
```

Quando o endereço existir, este bloco ganha o endereço completo e um link
"Ver no mapa". Nada mais muda.

O aviso de urgência é **conteúdo de segurança**, não rodapé decorativo:

> **Este site não atende urgências.** Em caso de dor no peito, falta de ar intensa,
> perda de consciência ou sinais de AVC, procure o pronto-socorro mais próximo ou
> ligue **192 (SAMU)**.

Contraste ≥ 4,5:1, ícone **e** texto, presente também na página `/agendar`.

---

## 3. Conteúdo como dado, não como JSX

Todo texto institucional vive em `lib/content/*.ts` tipado. Motivo: a médica vai
querer ajustar redação, e um `.ts` de conteúdo é revisável num PR sem tocar em
layout — além de ser onde a troca de "pós-graduanda" → "especialista" acontecerá em
2027, num lugar só.

```ts
// lib/config.ts — fonte única do perfil
export const PROFISSIONAL = {
  nome: 'Dra. Andressa Chaves Correia',
  nomeCurto: 'Dra. Andressa Correia',
  crm: 'CRM-SP 267.777',
  /** ⚠️ Só vira 'Especialista em Nutrologia' com RQE emitido. Ver FASE-10. */
  titulo: 'Médica · com atuação em Nutrologia',
  rqe: null as string | null,
  cidade: 'Guarulhos', uf: 'SP',
  telefone: '+5511998053826',
  email: 'andressa15correia@gmail.com',
  timezone: 'America/Sao_Paulo',

  /**
   * ⚠️ Endereço do consultório ainda NÃO definido (10/09/2026).
   * Enquanto for `null`, o site opera em "modo sem endereço" (§4.1):
   * o local é informado ao paciente na confirmação. Preencher aqui
   * ativa endereço no site, no `.ics` e no JSON-LD, sem tocar em mais nada.
   */
  endereco: null as {
    logradouro: string; numero: string; complemento?: string;
    bairro: string; cep: string; mapsUrl: string;
  } | null,
} as const;

/** Texto do local, usado no site, no `.ics` e nos e-mails. */
export function localConsulta(modalidade: 'in_person' | 'telehealth') {
  if (modalidade === 'telehealth') return 'Teleconsulta (link enviado antes da consulta)';
  return PROFISSIONAL.endereco
    ? `${PROFISSIONAL.endereco.logradouro}, ${PROFISSIONAL.endereco.numero}`
      + ` — ${PROFISSIONAL.endereco.bairro}, ${PROFISSIONAL.cidade}/${PROFISSIONAL.uf}`
    : `Consultório em ${PROFISSIONAL.cidade}/${PROFISSIONAL.uf}`
      + ' — endereço enviado na confirmação';
}
```

### 3.1 Modo sem endereço

Enquanto `endereco` for `null`, três coisas mudam **automaticamente**:

| Onde | Com endereço | Sem endereço (estado atual) |
|---|---|---|
| Seção Contato | Endereço completo + link do mapa | "Consultório em Guarulhos–SP · endereço enviado na confirmação" |
| `.ics` `LOCATION` | Endereço completo | Mesmo texto acima |
| JSON-LD | `streetAddress` + `postalCode` | Só `addressLocality: Guarulhos` (verdadeiro, e ainda útil para busca local) |

Nenhum `if` espalhado pelo código: tudo passa por `localConsulta()`. Definir o
endereço é editar **um objeto** — e um teste garante que o site não vaza
`"undefined"` em nenhum dos três lugares quando o campo é nulo.

---

## 4. Entregáveis

- [ ] `/`, `/sobre`, `/agendar` (casca), `/politica-de-privacidade`, `/termos-de-uso`
- [ ] `components/site/*` para as 7 seções
- [ ] `lib/config.ts` + `lib/content/*.ts`
- [ ] Retratos processados (AVIF/WebP, 3 tamanhos) e logos em SVG
- [ ] Navegação mobile com foco preso e fechamento por `Esc`
- [ ] Rodapé com nome, CRM, aviso legal e link para a política

## 5. Critérios de aceite

- [ ] Sem rolagem horizontal em 375 px
- [ ] Verificado em 375 / 393 / 768 / 1024, retrato e paisagem
- [ ] CTA principal do hero visível sem rolar, em 375 px
- [ ] Nenhuma informação essencial dependente de hover
- [ ] `<meta viewport>` com `viewport-fit=cover` e **sem** `user-scalable=no`
- [ ] Um `<h1>` por página; hierarquia sem pulo de nível
- [ ] `axe-core` sem violação crítica ou séria
- [ ] Navegação completa por teclado, com foco sempre visível
- [ ] Todas as imagens com `alt` significativo e dimensões declaradas
- [ ] Nome e CRM visíveis em **todas** as páginas (exigência CFM)
- [ ] Com `endereco: null`, nenhuma tela exibe "undefined", vírgula solta ou bloco
      vazio — teste cobrindo site, `.ics` e JSON-LD
- [ ] Aviso de urgência presente na home e em `/agendar`
- [ ] Nenhum preço, promoção, antes/depois ou depoimento de paciente
- [ ] LCP ≤ 2,0 s no Lighthouse mobile (4G simulado)
