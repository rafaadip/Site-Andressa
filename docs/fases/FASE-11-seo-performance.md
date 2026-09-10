# FASE 11 — SEO local e performance

> **Objetivo:** ser encontrada por quem procura "médica nutrologia Guarulhos" e
> carregar rápido no 4G de um celular mediano.
> **Depende de:** FASE-03 · **Estimativa:** 2–3 dias

---

## 1. SEO local — onde a busca realmente acontece

Para consultório, a maior parte do tráfego qualificado vem de busca **local com
intenção imediata**: "nutrólogo perto de mim", "médica nutrologia Guarulhos",
"consulta nutrologia zona leste". Isso muda as prioridades: o **Perfil da Empresa no
Google** costuma pesar mais que o site — mas o site é o que sustenta a autoridade e
converte.

### Prioridades

1. **Perfil da Empresa no Google** (fora do código, mas o item de maior impacto):
   categoria correta, endereço, horários, link para `/agendar`, fotos reais.
2. **NAP consistente** — nome, endereço e telefone idênticos em site, perfil e
   redes. Divergência confunde o algoritmo.
3. **Dados estruturados** no site (§2).
4. **Conteúdo local**: "Guarulhos", "São Paulo" e os hospitais de atuação no texto —
   de forma natural, não como lista de palavras-chave.

---

## 2. Dados estruturados (JSON-LD)

```jsonc
{
  "@context": "https://schema.org",
  "@type": "Physician",
  "name": "Dra. Andressa Chaves Correia",
  "medicalSpecialty": "https://schema.org/Nutrition",
  "url": "https://draandressacorreia.com.br",
  "image": "https://draandressacorreia.com.br/retrato.jpg",
  "telephone": "+55-11-99805-3826",
  "email": "andressa15correia@gmail.com",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Guarulhos",
    "addressRegion": "SP",
    "addressCountry": "BR"
  },
  "areaServed": [
    { "@type": "City", "name": "Guarulhos" },
    { "@type": "City", "name": "São Paulo" }
  ],
  "availableService": [
    { "@type": "MedicalProcedure", "name": "Consulta em Nutrologia" },
    { "@type": "MedicalProcedure", "name": "Teleconsulta" }
  ],
  "potentialAction": {
    "@type": "ReserveAction",
    "target": "https://draandressacorreia.com.br/agendar"
  }
}
```

Mais: `FAQPage` na seção de perguntas (rende rich result), `BreadcrumbList` nas
internas, `WebSite` com `SearchAction` — **não**, este site não tem busca; omitir.

> ⚠️ **Sem `AggregateRating` ou `Review`.** Além de o CFM restringir depoimento de
> paciente, marcar avaliação sem tê-la é violação das diretrizes do Google.

`medicalSpecialty: Nutrition` descreve o **serviço**, não reivindica título de
especialista — coerente com FASE-10. Revisar se, mesmo assim, pode ser lido como
alegação de especialidade; na dúvida, omitir e manter só `availableService`.

---

## 3. Metadados

```ts
export const metadata: Metadata = {
  metadataBase: new URL('https://draandressacorreia.com.br'),
  title: {
    default: 'Dra. Andressa Chaves Correia — Médica em Guarulhos, SP',
    template: '%s · Dra. Andressa Correia',
  },
  description:
    'Consultas em Nutrologia, presenciais em Guarulhos–SP e por teleconsulta. '
    + 'Agende online e receba a confirmação no seu calendário.',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Dra. Andressa Correia' },
  robots: { index: true, follow: true },
};
```

- `<title>` ≤ 60 caracteres, com a cidade — busca local é geográfica.
- `description` ≤ 155, com o verbo de ação ("Agende online").
- Imagem OG 1200×630 gerada por `opengraph-image.tsx` (retrato + nome + CRM).
- `/admin` e `/consulta/[token]` com `robots: { index: false }`.
- `sitemap.ts` e `robots.ts` dinâmicos.

---

## 4. Performance

### Alvos (Lighthouse mobile, 4G simulado)

| Métrica | Alvo | Limite |
|---|---|---|
| LCP | ≤ 1,8 s | 2,5 s |
| INP | ≤ 150 ms | 200 ms |
| CLS | ≤ 0,03 | 0,1 |
| TTFB | ≤ 400 ms | 800 ms |
| JS na home | ≤ 90 kB gzip | 130 kB |

### Como chegar lá

**Imagens** — o retrato do hero é o LCP:
```tsx
<Image src={retrato} alt="Dra. Andressa Chaves Correia" priority
       sizes="(max-width:768px) 90vw, 480px" placeholder="blur" />
```
AVIF com WebP de fallback; `width`/`height` sempre; abaixo da dobra, `loading="lazy"`.

**Fontes** — `next/font/local`, WOFF2, `display: 'swap'`, `preload` **só** em Jost
400 e Playfair 600. Subset latin + latin-ext (o português precisa de `ã`, `ç`, `õ`).
Zero request a CDN de terceiro (ADR-005).

**JavaScript** — a home é quase toda Server Component. O widget de agendamento é o
único bloco interativo, e entra por `dynamic()` com `ssr: false` quando está abaixo
da dobra. `motion` importado só onde é usado.

**CSS** — Tailwind v4 já faz tree-shaking; CSS crítico inline pelo Next.

**Cache** — estáticos com `max-age=31536000, immutable`; páginas via ISR com
`revalidate: 3600`; API de disponibilidade com `s-maxage=60` (FASE-04).

---

## 5. Entregáveis

- [ ] JSON-LD `Physician` + `FAQPage`
- [ ] `metadata` por rota, `sitemap.ts`, `robots.ts`
- [ ] `opengraph-image.tsx`
- [ ] Imagens em AVIF/WebP, três tamanhos
- [ ] Fontes self-hosted com subset
- [ ] Lighthouse CI no pipeline, com orçamento de performance
- [ ] Guia (em `docs/`) para a médica configurar o Perfil da Empresa no Google

## 6. Critérios de aceite

- [ ] Lighthouse mobile: Performance ≥ 95, Acessibilidade 100, SEO 100
- [ ] LCP ≤ 1,8 s no teste de campo simulado
- [ ] CLS ≤ 0,03 (sem salto de fonte nem de imagem)
- [ ] JSON-LD sem erro no Rich Results Test
- [ ] `/admin` e `/consulta/*` fora do sitemap e com `noindex`
- [ ] Nenhuma requisição a domínio de terceiro no carregamento inicial
- [ ] Prévia de link correta ao compartilhar no WhatsApp
