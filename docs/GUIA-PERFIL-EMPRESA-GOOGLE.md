# Guia — Perfil da Empresa no Google

> Para a Dra. Andressa. É o item de **maior impacto** na busca local
> ("médica nutrologia Guarulhos", "nutrólogo perto de mim") — mais que o
> próprio site ([FASE-11 §1](fases/FASE-11-seo-performance.md)). Leva cerca de
> uma hora, mais a espera da verificação.

## Antes de começar

- [ ] **Endereço do consultório definido.** Sem ele, o perfil só existe como
      "área de atendimento", sem pino no mapa — e o "pacote local" (o mapinha
      com três resultados) fica praticamente fora de alcance. Enquanto isso,
      dá para criar o perfil como área de atendimento e completar depois.
- [ ] Conta Google que você usa no dia a dia (a mesma do painel).
- [ ] 3 a 5 fotos **reais**: fachada, recepção, consultório, você de jaleco.

## Passo a passo

1. Acesse **business.google.com** → *Adicionar empresa*.
2. **Nome**: exatamente `Dra. Andressa Chaves Correia` — igual ao site e ao
   Instagram. Não acrescente palavras-chave ao nome ("Nutrologia Guarulhos"):
   o Google trata como spam e pode suspender o perfil.
3. **Categoria principal**: `Médico`. Não escolha "Nutrólogo" nem
   "Especialista em…": sem RQE, isso é anúncio de especialidade (mesmo motivo
   pelo qual o site não usa a palavra — [FASE-10](fases/FASE-10-compliance-lgpd-cfm.md)).
4. **Endereço**:
   - com consultório: o endereço completo, **idêntico** ao que for colocado em
     `PROFISSIONAL.endereco` (`lib/config.ts`) — nome, endereço e telefone
     precisam bater letra por letra em todo lugar (o tal "NAP");
   - sem consultório: marque "Atendo clientes no local deles" e informe a
     área: Guarulhos e São Paulo.
5. **Telefone**: `(11) 99805-3826` — o mesmo do site.
6. **Site**: `https://draandressacorreia.com.br`.
7. **Link de agendamento**: `https://draandressacorreia.com.br/agendar`
   (Perfil → *Reservas*/*Agendamentos* → link de agendamento).
8. **Horário de funcionamento**: o mesmo da semana padrão do painel
   (`/admin/disponibilidade`). Divergência confunde o paciente.
9. **Descrição** (até 750 caracteres). Sugestão, conforme as regras do CFM —
   sem superlativo, sem promessa, sem preço:

   > Médica com atuação em Nutrologia, com consultas presenciais em Guarulhos–SP
   > e por teleconsulta. Avaliação da história clínica, da rotina e dos hábitos
   > para construir um plano individualizado. Agendamento online, sem cadastro:
   > a consulta vai direto para o calendário do seu celular.
   > CRM-SP 267.777.

10. **Verificação**: o Google envia código por carta, telefone ou pede um
    vídeo curto do local. Sem verificação, o perfil não aparece.

## Depois de verificado

- [ ] Preencher `PROFISSIONAL.endereco` em `lib/config.ts` (inclusive
      `mapsUrl` com o link "Compartilhar" do Maps). Isso ativa, de uma vez, o
      endereço no site, no convite de calendário (`.ics`), nos e-mails e nos
      dados estruturados (JSON-LD) — [FASE-03 §3.1](fases/FASE-03-site-institucional.md).
- [ ] Conferir o NAP (nome, endereço, telefone) no site, no perfil e no
      Instagram: iguais, caractere por caractere.
- [ ] Testar a página no [Teste de pesquisa aprimorada](https://search.google.com/test/rich-results).

## O que NÃO fazer (CFM e diretrizes do Google)

| Não | Por quê |
|---|---|
| Pedir avaliações a pacientes ou responder com detalhe clínico | Depoimento de paciente é restrito na publicidade médica, e responder com detalhe expõe dado de saúde |
| Publicar preço, desconto ou "primeira consulta grátis" | Vedado na publicidade médica |
| Foto de "antes e depois" | Vedado |
| "Melhor nutrologia de Guarulhos", "referência" | Autopromoção comparativa é vedada |
| Endereço aproximado ou de outra clínica | Engana o paciente e derruba o ranqueamento local |

Avaliações que chegarem espontaneamente: pode agradecer de forma genérica
("Obrigada pela confiança."), sem confirmar que a pessoa é paciente.
