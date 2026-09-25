# Roteiro de teste manual — antes do go-live

> O que a automação **não** cobre ([FASE-12 §5–6](fases/FASE-12-qa-acessibilidade.md)):
> teclado virtual, barra de endereço que some, barra de gestos, leitor de tela
> real e o comportamento dos apps de calendário. Preencha a coluna "Resultado"
> com data, aparelho e ✅/❌; anexe prints ou vídeo no PR de go-live.
>
> Automatizado (verde localmente; o CI roda o mesmo conjunto): 648 testes no
> Vitest (unitários, componentes, integração, API) e 123 E2E (axe WCAG 2.2 AA
> em todas as páginas públicas e do painel, matriz de viewports 375–1440,
> teclado, fuso de Manaus e 9 aparelhos emulados — iPhone SE/15/15 Pro Max,
> Galaxy S24/S9+/Tab S4, iPad retrato e paisagem, desktop), Lighthouse. A
> emulação roda no Chromium: WebKit, teclado virtual e notch só aqui. Ver
> [QA](QA.md).

## 1. Paciente — celular, com uma mão

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 1.1 | iPhone (Safari): abrir o link a partir do Instagram, tocar "Agendar consulta" | Sem zoom ao focar campos; botão de avançar acima da barra de gestos | |
| 1.2 | Concluir um agendamento presencial | Tela de confirmação com o nome; nenhum salto de layout | |
| 1.3 | "iPhone, Outlook e outros" | Abre "Adicionar ao Calendário" direto, hora correta, alarme 2 h antes | |
| 1.4 | E-mail de confirmação no app Mail | Cartão do evento (anexo `.ics`) com botão "Adicionar" | |
| 1.5 | Link da consulta → Cancelar | Confirmação em duas etapas; página vira "Consulta cancelada" | |
| 1.6 | **Abrir o e-mail/arquivo de cancelamento** | **O evento SOME do Calendário do iPhone** — prova de UID/SEQUENCE | |
| 1.7 | Android (Chrome): repetir 1.2 e "Google Agenda" | Evento no Google Agenda com hora e local corretos | |
| 1.8 | Gmail web e Outlook web: abrir o e-mail | Layout íntegro, botões de 44 px, anexo reconhecido | |
| 1.9 | iPad retrato e paisagem | Coluna de 680 px no retrato; nada cortado | |
| 1.10 | Ajustes → Tela → Texto maior (iOS) | Nada cortado nem sobreposto | |

## 2. Médica — painel no celular

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 2.1 | Entrar com Google (conta autorizada) | Cai na agenda de hoje | |
| 2.2 | Entrar com outra conta Google | "Essa conta do Google não tem acesso ao painel." | |
| 2.3 | Conectar a agenda (Integrações) | "Conectada", avisos instantâneos ativos | |
| 2.4 | Agendar pelo site | Evento aparece na agenda Google **em segundos**, com motivo (se ligado) | |
| 2.5 | Apagar esse evento no app Google Agenda | Em até 1 min (webhook) ou 15 min (cron): consulta cancelada, paciente recebe e-mail | |
| 2.6 | Mover um evento de consulta no celular | Consulta remarcada; paciente recebe o `.ics` novo e o iPhone atualiza o evento | |
| 2.7 | Criar compromisso pessoal na agenda | O horário some do site | |
| 2.8 | "Bloquear o resto de hoje" | Um toque; horários de hoje somem | |
| 2.9 | Bloquear um dia com consulta | Exige decidir "cancelar e avisar" ou "manter" | |
| 2.10 | Remarcar pelo painel | Paciente recebe o novo horário; evento move na agenda Google | |
| 2.11 | Ligar e WhatsApp a partir do cartão | Um toque abre o discador / o WhatsApp com o número | |

## 3. Acessibilidade — com tecnologia assistiva real

| # | Verificação | Como | Resultado |
|---|---|---|---|
| 3.1 | Fluxo completo com **VoiceOver** (iOS) | Etapas anunciadas ("Etapa 2 de 3"), horários lidos com o dia | |
| 3.2 | Fluxo completo com **NVDA** + Firefox | Grupos de rádio com setas; erros lidos ao aparecer | |
| 3.3 | Só teclado, sem mouse (desktop) | Tab/Shift+Tab, setas, Esc no menu; foco sempre visível | |
| 3.4 | Zoom de 200 % | Sem rolagem horizontal, sem texto cortado | |
| 3.5 | Reduzir movimento (macOS/iOS) | Sem animação de troca de etapa | |
| 3.6 | Alto contraste (Windows) | Bordas de campo e foco visíveis | |

## 4. E-mail e entregabilidade

| # | Verificação | Resultado |
|---|---|---|
| 4.1 | mail-tester.com ≥ 9/10 | |
| 4.2 | SPF, DKIM e DMARC "pass" no cabeçalho de um e-mail recebido no Gmail | |
| 4.3 | Versão texto puro legível (Gmail → "Mostrar original") | |
| 4.4 | E-mail para endereço inexistente → aviso à médica e selo "E-mail não entregue" no painel | |

## 5. Registro

| Data | Quem | Aparelhos | Observações |
|---|---|---|---|
| | | | |
