# FASE 10 — Conformidade: LGPD e CFM

> **Objetivo:** o site pode existir sem expor a médica a risco ético ou
> sancionatório.
> **Depende de:** FASE-03, FASE-07 · **Estimativa:** 3 dias
>
> ⚠️ **Este documento é orientação de engenharia, não parecer jurídico.** As
> resoluções do CFM são revisadas com frequência. Antes do lançamento, o texto
> vigente deve ser conferido com o CRM-SP e, idealmente, com advogado de direito
> médico. Os itens abaixo são os que **têm consequência no código**.

---

## 1. O ponto mais sensível: título profissional

### O problema

O currículo mostra: **pós-graduação Lato Sensu em Nutrologia pela Afya, fev/2026 –
jul/2027 — em curso**. O material de redes sociais fornecido usa
**"Médica Especialista em Nutrologia"**.

No Brasil, anunciar especialidade exige **registro de qualificação de especialista
(RQE)** junto ao CRM. RQE decorre de residência médica reconhecida pela CNRM ou de
título de especialista da sociedade da área, homologado pela AMB/CFM — **não** de
pós-graduação Lato Sensu, e certamente não de curso em andamento.

Anunciar especialidade sem RQE é infração ética passível de processo no CRM.

### A regra no código

```ts
// lib/config.ts — FONTE ÚNICA. Nenhum título é escrito à mão em outro arquivo.
export const PROFISSIONAL = {
  nome: 'Dra. Andressa Chaves Correia',
  crm: 'CRM-SP 267.777',
  rqe: null as string | null,   // ← preencher SÓ quando o CRM emitir
  titulo: 'Médica · com atuação em Nutrologia',
} as const;

/** Rótulo público. Muda sozinho quando o RQE for registrado. */
export function tituloPublico() {
  return PROFISSIONAL.rqe
    ? `Médica · Especialista em Nutrologia · RQE ${PROFISSIONAL.rqe}`
    : PROFISSIONAL.titulo;
}
```

| ❌ Não usar (sem RQE) | ✅ Usar |
|---|---|
| Especialista em Nutrologia | Médica · com atuação em Nutrologia |
| Nutróloga | Pós-graduanda em Nutrologia (Afya) |
| RQE 00000 | *(omitir o campo por completo)* |

Um teste em FASE-12 varre `app/` e `components/` procurando "especialista",
"nutróloga" e "RQE" fora de `lib/config.ts`, e **quebra o build**.

---

## 2. Publicidade médica

Regras que se traduzem em decisões de produto:

| Restrição | Efeito no site |
|---|---|
| Identificação obrigatória | Nome + CRM em **todas** as páginas — header/rodapé, e no `.ics` e nos e-mails |
| Sem preço, desconto ou promoção | **Nenhum valor de consulta.** Também não há pagamento online (ADR fora de escopo) |
| Sem antes/depois | Zero imagem comparativa |
| Sem depoimento de paciente | Sem seção de avaliações; **nem embed do Google Reviews** |
| Sem autopromoção comparativa | Nada de "a melhor", "referência em", "exclusivo" |
| Sem sensacionalismo | Copy sóbria; sem promessa de resultado |
| Sem garantia de resultado | Revisar cada verbo do texto |
| Sem foto de paciente | Só retratos da médica |
| Telemedicina | Página de teleconsulta menciona a norma do CFM e registra o consentimento |

### Checklist de revisão de copy

- [ ] Nenhum superlativo ("melhor", "referência", "exclusivo", "único")
- [ ] Nenhuma promessa ("você vai emagrecer", "resultado garantido")
- [ ] Nenhum valor, parcelamento ou "primeira consulta grátis"
- [ ] Nenhum depoimento, nota ou estrela
- [ ] Nenhuma imagem de resultado
- [ ] Nome e CRM visíveis
- [ ] Aviso de urgência presente

---

## 3. LGPD

### 3.1 Mapa de dados

| Dado | Categoria | Base legal | Retenção |
|---|---|---|---|
| Nome | Pessoal | Execução de contrato (Art. 7º, V) | 5 anos |
| E-mail / telefone | Pessoal | Execução de contrato | 5 anos |
| **Motivo da consulta** | **Sensível — saúde (Art. 5º, II)** | **Consentimento específico (Art. 11, I)** | **90 dias** |
| Data/hora | Pessoal | Execução de contrato | 5 anos |
| Hash de IP do consentimento | Pessoal (pseudonimizado) | Obrigação legal (prova) | 5 anos |
| Métricas do site | Anônimo agregado | — | 24 meses |

**Decisão central: o sistema não é prontuário.** Não há evolução clínica, exame,
diagnóstico ou prescrição. Isso mantém o projeto fora do alcance das normas de
prontuário eletrônico e da certificação SBIS-CFM — e reduz drasticamente a
superfície de risco. Está registrado como não-objetivo na arquitetura para que
ninguém adicione "só um campinho de observação clínica" mais tarde.

### 3.2 Minimização

Não coletamos: CPF, data de nascimento, endereço, convênio, peso, altura, foto.

Cada campo passou pelo teste: *"o agendamento funciona sem isso?"* Se sim, saiu.
CPF só faria sentido em faturamento — que não existe aqui.

### 3.3 Consentimento

Dois checkboxes distintos, ambos **desmarcados** por padrão (Art. 8º — silêncio não
é consentimento):

1. **Dados de contato** — obrigatório, para o agendamento.
2. **Motivo da consulta** — só aparece se o campo foi preenchido; texto destacado
   informando que é **informação de saúde**.

Registrado: `consent_lgpd_at`, `consent_health_at`, `consent_ip_hash`
(SHA-256(ip + `TOKEN_SALT`) — prova sem armazenar o IP), versão do texto aceito.

### 3.4 Direitos do titular (Art. 18)

`/politica-de-privacidade` traz um canal explícito. Prazo de resposta: 15 dias.

| Direito | Implementação |
|---|---|
| Confirmação e acesso | `/consulta/<token>` mostra tudo; por e-mail, exportação em JSON |
| Correção | Pelo link de gestão ou por e-mail |
| Eliminação | Botão no `/admin`; anonimiza em vez de deletar a linha (preserva integridade da agenda: `patient_name = 'Titular removido'`, contato e motivo nulos) |
| Portabilidade | Exportação JSON |
| Revogação | Revogar o consentimento de saúde apaga `patient_note` imediatamente |

### 3.5 Retenção automática

```
/api/cron/retencao  → 0 5 * * *   (02:00 em Brasília)

  1. UPDATE appointment SET patient_note = NULL, consent_health_at = NULL
     WHERE patient_note IS NOT NULL AND starts_at < now() - interval '90 days';

  2. UPDATE appointment SET patient_name='—', patient_email=NULL, patient_phone=NULL
     WHERE starts_at < now() - interval '5 years';

  3. DELETE FROM audit_log WHERE at < now() - interval '5 years';
```

Cada execução registra no `audit_log` o que apagou — a trilha da própria exclusão.

### 3.6 Política de privacidade

Linguagem simples, sem juridiquês defensivo. Deve responder, nesta ordem:

1. Quem é a controladora (nome, CRM, e-mail de contato)
2. Quais dados são coletados e por quê
3. Que o motivo da consulta é dado de saúde, coletado só com consentimento
4. Com quem são compartilhados — **nomear**: Google (Calendar), Resend (e-mail),
   Supabase (banco), Vercel (hospedagem)
5. Transferência internacional: dizer com clareza que Google, Resend e Vercel podem
   processar fora do Brasil, com as salvaguardas contratuais aplicáveis
6. Por quanto tempo
7. Direitos do titular e como exercê-los
8. Que o site **não usa cookies de rastreamento** (ADR-005)

---

## 4. Acessibilidade como conformidade

A Lei Brasileira de Inclusão (13.146/2015) trata acessibilidade digital como
obrigação, não cortesia. WCAG 2.2 AA é o alvo em FASE-12 — e aqui vale registrar que
não é apenas boa prática técnica.

---

## 5. Entregáveis

- [ ] `lib/config.ts` como fonte única de título e registro
- [ ] `/politica-de-privacidade` e `/termos-de-uso`
- [ ] Duplo consentimento no formulário, com registro auditável
- [ ] `/api/cron/retencao` com log de auditoria
- [ ] Exportação e anonimização no `/admin`
- [ ] Teste de build que barra "especialista"/"nutróloga"/"RQE" fora do config
- [ ] RIPD (Relatório de Impacto) em `docs/RIPD.md` — exigível pela ANPD

## 6. Critérios de aceite

- [ ] Nenhuma menção a "especialista" ou "nutróloga" no site
- [ ] Nome e CRM em todas as páginas públicas
- [ ] Nenhum preço, depoimento ou antes/depois
- [ ] Consentimentos desmarcados por padrão e registrados com data/hora
- [ ] Motivo da consulta apagado automaticamente após 90 dias (teste com relógio
      adiantado)
- [ ] Política nomeia todos os operadores e a transferência internacional
- [ ] Nenhum cookie não essencial (verificado com DevTools em janela limpa)
- [ ] Revisão jurídica registrada antes do go-live
