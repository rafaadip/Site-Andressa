# FASE 03 — Site institucional

> **Objetivo:** as páginas públicas — premium, minimalistas, em conformidade com o
> CFM e prontas para busca local.
> **Depende de:** FASE-01, FASE-02 · **Habilita:** FASE-11
> **Estimativa:** 4–5 dias

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
- Mobile: empilha; retrato limitado a 60 vh para o CTA caber acima da dobra.

### 2.2 Credenciais

Faixa de 4 itens sobre `ivory-100`, marcador em `gold-500`:

| Item | Texto |
|---|---|
| Registro | **CRM-SP 207.737** · Registro ativo |
| Formação | **Medicina — UNINOVE** · 2019–2024 |
| Pós-graduação | **Nutrologia — Afya** · em curso |
| Certificação | **ACLS** · Suporte avançado de vida |

> ⚠️ "Pós-graduação **em curso**" é redação obrigatória enquanto não houver RQE.
> Ver [FASE-10](FASE-10-compliance-lgpd-cfm.md).

### 2.3 Sobre

Duas colunas (foto 4:5 + texto). Conteúdo derivado do currículo:

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

Três cartões sobre **espresso-900** (contraponto do carrossel):

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

Dois blocos. O aviso de urgência é **conteúdo de segurança**, não rodapé decorativo:

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
  crm: 'CRM-SP 207.737',
  /** ⚠️ Só vira 'Especialista em Nutrologia' com RQE emitido. Ver FASE-10. */
  titulo: 'Médica · com atuação em Nutrologia',
  rqe: null as string | null,
  cidade: 'Guarulhos', uf: 'SP',
  telefone: '+5511998053826',
  email: 'andressa15correia@gmail.com',
  timezone: 'America/Sao_Paulo',
} as const;
```

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
- [ ] Um `<h1>` por página; hierarquia sem pulo de nível
- [ ] `axe-core` sem violação crítica ou séria
- [ ] Navegação completa por teclado, com foco sempre visível
- [ ] Todas as imagens com `alt` significativo e dimensões declaradas
- [ ] Nome e CRM visíveis em **todas** as páginas (exigência CFM)
- [ ] Aviso de urgência presente na home e em `/agendar`
- [ ] Nenhum preço, promoção, antes/depois ou depoimento de paciente
- [ ] LCP ≤ 2,0 s no Lighthouse mobile (4G simulado)
