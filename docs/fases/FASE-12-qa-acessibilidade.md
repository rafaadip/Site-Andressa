# FASE 12 — QA, testes e acessibilidade

> **Objetivo:** provar que funciona — em particular a matemática de horários, que é
> onde os defeitos são invisíveis.
> **Depende de:** todas as anteriores · **Estimativa:** 4 dias

---

## 1. Pirâmide de testes

```
        ╱ Manual ╲          calendários reais, leitores de tela, dispositivos
      ╱───────────╲
    ╱   E2E (12)    ╲       fluxo completo no navegador
  ╱───────────────────╲
╱  Integração (~30)     ╲    API + banco real
─────────────────────────
  Unitário (~120)          motor de disponibilidade, .ics, fuso, validação
```

O peso está na base **de propósito**: o motor de disponibilidade e o gerador de
`.ics` são lógica pura, determinística e crítica. É onde o teste automatizado tem o
melhor retorno.

---

## 2. Testes unitários (Vitest)

### 2.1 Fuso horário — o mais importante

```ts
describe('fuso horário', () => {
  it.each(['UTC', 'America/Sao_Paulo', 'Asia/Tokyo', 'America/New_York'])(
    'produz o mesmo resultado com TZ=%s no servidor',
    (tz) => {
      process.env.TZ = tz;
      const slots = gerarSlots(REGRA_FIXA, JANELA_FIXA);
      expect(slots.map(s => s.inicio.toISOString())).toEqual(ESPERADO);
    },
  );

  it('não duplica nem some slot na transição de horário de verão', () => {
    // zona que TEM DST, para provar que a lógica é correta por construção
    const slots = gerarSlots(regraEm('America/New_York'), semanaDaTransicao);
    expect(new Set(slots.map(s => +s.inicio)).size).toBe(slots.length);
  });

  it('mantém a hora local quando a regra do fuso muda', () => {
    // "terça às 14h" continua 14h na parede, mesmo com offset diferente
  });
});
```

O primeiro teste é o que impede a classe inteira de bugs de fuso: se o fuso do
servidor influenciar a saída, o sistema está errado — independentemente de o
resultado parecer certo em desenvolvimento.

### 2.2 Motor de disponibilidade

Casos obrigatórios (de [FASE-04 §4](FASE-04-motor-disponibilidade.md)):

| Caso | Esperado |
|---|---|
| Ocupado idêntico à janela | janela some |
| Ocupado engloba a janela | janela some |
| Ocupado no meio | duas janelas |
| Ocupado **encosta** no início (`fim == início`) | janela intacta |
| Ocupados sobrepostos entre si | normalizados antes de subtrair |
| Slot que ultrapassa o fim da janela | descartado |
| Buffer incluído no bloqueio | próximo slot em `+duração+buffer` |
| Lead time de 12 h | slot de daqui a 6 h não aparece |
| Horizonte de 60 dias | slot em D+61 não aparece |
| Exceção `extra` fora da regra semanal | slot aparece |
| Regra sem vaga | `slots: []`, não erro |

### 2.3 Gerador `.ics`

```ts
it('dobra linhas em 75 octetos sem cortar caractere multibyte', () => {
  const ics = gerarIcs({ ...base, pacienteNome: 'José Antônio Gonçalves ' .repeat(6) });
  for (const linha of ics.split('\r\n')) {
    expect(Buffer.byteLength(linha, 'utf8')).toBeLessThanOrEqual(75);
  }
  expect(() => ICAL.parse(ics)).not.toThrow();
});

it('escapa vírgula, ponto-e-vírgula e quebra de linha', () => {
  const ics = gerarIcs({ ...base, motivo: 'Dor de cabeça, náusea; desde 10/09\nPiora à noite' });
  expect(ics).toContain('Dor de cabeça\\, náusea\; desde 10/09\\nPiora à noite');
});

it('mantém o UID e incrementa SEQUENCE ao cancelar', () => {
  const a = gerarIcs(ag, 'REQUEST');
  const b = gerarIcs({ ...ag, icsSequence: ag.icsSequence + 1 }, 'CANCEL');
  expect(uid(a)).toBe(uid(b));
  expect(seq(b)).toBeGreaterThan(seq(a));
});
```

Validação cruzada com `ical.js` — biblioteca independente, para não testar o gerador
contra ele mesmo.

---

## 3. Testes de integração

Postgres real (Testcontainers ou service container no CI).

```ts
it('permite exatamente um agendamento em 20 tentativas concorrentes', async () => {
  const respostas = await Promise.all(
    Array.from({ length: 20 }, () => postAgendamento({ inicio: SLOT })),
  );
  expect(respostas.filter(r => r.status === 201)).toHaveLength(1);
  expect(respostas.filter(r => r.status === 409)).toHaveLength(19);
});

it('não duplica com a mesma Idempotency-Key', async () => {
  const chave = randomUUID();
  const a = await postAgendamento({ inicio: SLOT }, chave);
  const b = await postAgendamento({ inicio: SLOT }, chave);
  expect(b.status).toBe(200);
  expect(b.body.id).toBe(a.body.id);
});

it('mantém o agendamento quando o Google falha', async () => {
  mockGoogle.events.insert.mockRejectedValue(new Error('503'));
  const r = await postAgendamento({ inicio: SLOT });
  expect(r.status).toBe(201);
  expect(await estadoSync(r.body.id)).toBe('pending');
});
```

Também: expiração de `held`, cancelamento libera o horário, webhook do Google
sincroniza cancelamento externo, `syncToken` expirado (410) dispara full sync.

---

## 4. E2E (Playwright)

| # | Cenário |
|---|---|
| 1 | Agendamento presencial, do hero à confirmação |
| 2 | Teleconsulta, com fuso do paciente diferente |
| 3 | Fluxo inteiro **só com teclado** |
| 4 | Slot perdido (409): dados preservados, seleção refeita |
| 5 | Validação: erros por campo, foco no primeiro inválido |
| 6 | Consentimento de saúde só aparece com motivo preenchido |
| 7 | Voltar da etapa 3 para a 1 preserva tudo |
| 8 | Cancelamento por `/consulta/<token>` |
| 9 | Token inválido → 404 |
| 10 | Admin: bloquear período com agendamento dentro exige decisão |
| 11 | Admin: e-mail fora da allowlist é rejeitado |
| 12 | Download do `.ics` e validação do conteúdo baixado |

Viewports: 375×667 (iPhone SE), 390×844 (iPhone 15), 768×1024, 1440×900.

---

## 5. Acessibilidade

### Automatizado

```ts
test('sem violações em nenhuma etapa', async ({ page }) => {
  for (const etapa of [1, 2, 3, 4]) {
    await irParaEtapa(page, etapa);
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(r.violations).toEqual([]);
  }
});
```

`axe-core` pega ~40 % dos problemas reais. O resto exige teste manual.

### Manual — obrigatório antes do go-live

| Verificação | Como |
|---|---|
| VoiceOver (iOS) no fluxo completo | iPhone real |
| NVDA (Windows) no fluxo completo | Firefox |
| Navegação por teclado | Tab, Shift+Tab, setas no radiogroup, Esc no modal |
| Ordem de foco = ordem visual | Tab do topo ao rodapé |
| Zoom 200 % | Sem rolagem horizontal, sem texto cortado |
| Texto do sistema aumentado | iOS Ajustes → Tela → Texto maior |
| `prefers-reduced-motion` | macOS "Reduzir movimento" |
| Modo de alto contraste | Windows |
| Só com teclado, sem mouse | Sessão completa |

### Checklist WCAG 2.2 AA — itens que costumam falhar

- [ ] 1.4.3 Contraste ≥ 4,5:1 (texto) — script do CI
- [ ] 1.4.11 Contraste de componente ≥ 3:1 — **borda de input** é o que mais reprova
- [ ] 1.4.10 Refluxo em 320 px sem rolagem horizontal
- [ ] 2.1.2 Sem armadilha de foco no menu mobile
- [ ] 2.4.7 Foco sempre visível
- [ ] 2.4.11 Foco não obscurecido por header fixo *(novo na 2.2 — o header sticky
      cobre o campo focado ao navegar por Tab; `scroll-margin-top` resolve)*
- [ ] 2.5.8 Alvo ≥ 24×24 CSS px *(usamos 44, com folga)*
- [ ] 3.3.2 Rótulo visível em todo campo
- [ ] 3.3.7 Sem reentrada de informação já fornecida *(novo na 2.2 — o resumo na
      etapa 3 não pode pedir de novo o que já foi escolhido)*
- [ ] 4.1.3 Mensagem de status com `aria-live`

---

## 6. Teste manual de calendário

Automatizar não cobre isto. Roteiro documentado com prints:

| Cliente | Verificar |
|---|---|
| Apple Calendar (iOS 17+) | `.ics` do e-mail e do download; hora correta; alarme; **cancelamento remove o evento** |
| Apple Calendar (macOS) | idem |
| Google Agenda (Android) | anexo e link `TEMPLATE` |
| Google Agenda (web) | idem |
| Outlook (web e desktop) | anexo `.ics` |
| Feed `webcal://` no iPhone | assinatura, aparecimento, atualização |

**O teste que mais importa:** marcar → cancelar → confirmar que o evento
**desapareceu** do iPhone. É o que prova que `UID` e `SEQUENCE` estão certos.

---

## 7. Lint específico do projeto

```jsonc
// eslint.config.js
"no-restricted-syntax": ["error",
  { "selector": "BinaryExpression[operator='+'][right.value=10800000]",
    "message": "Offset de fuso na mão. Use lib/datetime.ts." },
  { "selector": "CallExpression[callee.property.name='getTimezoneOffset']",
    "message": "Fuso do servidor não é o da clínica. Use lib/datetime.ts." }
],
"no-restricted-imports": ["error", { "patterns": [
  { "group": ["luxon"], "importNames": ["DateTime"],
    "message": "Importe de lib/datetime.ts.",
    "allowFrom": ["lib/datetime.ts"] }
]}]
```

Mais: script que barra "especialista"/"nutróloga"/"RQE" fora de `lib/config.ts`
(FASE-10) e `scripts/check-contrast.ts` (FASE-01).

---

## 8. Entregáveis

- [ ] ≥ 120 testes unitários, ≥ 90 % de cobertura em `lib/availability` e `lib/calendar`
- [ ] ~30 testes de integração com Postgres real
- [ ] 12 cenários E2E nos quatro viewports
- [ ] `axe-core` em todas as rotas públicas
- [ ] Roteiro manual documentado, com resultados registrados
- [ ] Regras de lint do §7

## 9. Critérios de aceite

- [ ] CI verde em todos os jobs
- [ ] Zero violação `axe` crítica ou séria
- [ ] Teste de concorrência passa 10 execuções seguidas
- [ ] Testes de fuso passam com quatro `TZ` diferentes
- [ ] Cancelamento verificado manualmente em Apple Calendar real
- [ ] Fluxo completo por teclado, sem mouse, registrado em vídeo
- [ ] Fluxo completo com VoiceOver, registrado em vídeo
