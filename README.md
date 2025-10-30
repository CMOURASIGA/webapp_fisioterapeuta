# Fisio System — Web App (Google Apps Script)

Aplicação de prontuário e relatórios em Google Apps Script (HTML Service) para clínicas de fisioterapia. Oferece cadastro de pacientes, registro de atendimentos (sinais vitais e nota SOAP), geração de documentos no Google Docs e agenda com integração ao Google Calendar.

## Visão Geral

- Frontend em HTML/CSS/JS (HTML Service) — `index.html` + `index.js.html`.
- Backend em Google Apps Script (Apps Script) — rotas em `router.gs` e serviços em `*.gs`.
- Relatórios no fluxo “Docs‑only”: o Google Docs abre em nova aba para visualizar, imprimir e exportar.
- Agenda semanal integrada ao Calendar (opcional), com criação de eventos no calendário do usuário.

## Funcionalidades

- Pacientes: cadastro/edição, alteração de status, busca por nome/CPF.
- Atendimentos: abertura, sinais vitais, nota SOAP, encerramento e histórico por paciente.
- Profissionais: cadastro rápido a partir do fluxo de atendimento.
- Relatórios (aba “Relatórios”):
  - Ficha de Avaliação (Google Docs)
  - Evolução Clínica (comparativos básicos)
  - Relatório de Alta
- Agenda (aba “Agenda”):
  - Visualização semanal (Seg–Dom, 8h–18h)
  - Novo Agendamento com seleção de paciente, início/fim e título
  - Integração com Google Calendar (cria evento no calendário padrão do usuário)

## Novidades nesta versão

- Correção de pop‑up nos relatórios: pré‑abre a janela e redireciona a URL do Docs (evita bloqueio de pop‑ups).
- Agenda end‑to‑end (frontend + backend): grade semanal, modal de criação, persistência na planilha e gravação no Google Calendar.
- Limpeza de encoding (acentos e símbolos corrigidos em todos os arquivos).
- UX do modal de Agenda: datetime no fuso local, “Fim” auto +1h, título sugerido com nome do paciente.
- Ajuste de UI: remoção do botão hambúrguer da navbar (não funcional).

## Estrutura do Projeto

- `index.html` — página principal do Web App (abas Dashboard, Pacientes, Atendimentos, Relatórios, Agenda, Profissionais).
- `index.js.html` — lógica do frontend (UI, rotas, modais, Agenda e Relatórios).
- `report.gs` — geração de dados e documentos (Google Docs) para relatórios.
- `agenda.gs` — endpoints da Agenda (`getAgenda`, `createAgendaEntry`) e integração com Calendar.
- `router.gs` — roteamento de API (`/api/*`) para frontend (GET/POST via `google.script.run`).
- `sheets.gs`, `setup.gs` — acesso e preparação das abas do “banco” (Spreadsheet), criação automática da aba `Agenda` quando necessário.

## Requisitos

- Conta Google com acesso ao Drive/Docs (e Calendar para a Agenda).
- Apps Script com permissões para: `DocumentApp`, `DriveApp`, `PropertiesService`, `HtmlService`, `CalendarApp` (para Agenda/Calendar).
- Pop‑ups habilitados para o domínio do Web App (Docs abre em nova aba).

## Configuração (Apps Script)

1) Crie um projeto Apps Script (standalone) e copie os arquivos do repositório.
2) Garanta a função include(name) no backend:
   ```js
   function include(name) {
     return HtmlService.createTemplateFromFile(name).getRawContent();
   }
   ```
3) Execute `ensureSystemInitialized()` (ou acesse o app) para criar a planilha de dados e as abas necessárias.
4) Para a Agenda/Calendar, publique o Web App com “Executar como: usuário que acessa o app” e autorize os escopos do Calendar.

## Deploy como Web App

1) Publicar → Implantar como aplicativo da web.
2) Defina quem pode acessar e a versão.
3) Acesse via URL do Web App (necessário para `google.script.run`).

## Fluxo de Relatórios (Docs‑only)

- O backend cria o Google Docs e retorna `{ success, url, file_id, file_name }`.
- O frontend abre a URL em nova aba (com pré‑abertura para evitar bloqueio de pop‑ups).

## Fluxo da Agenda

- `GET /api/agenda` → retorna eventos do período solicitado.
- `POST /api/agenda` → cria um registro na aba `Agenda` e tenta inserir o evento no Calendar padrão do usuário.
- A grade semanal é renderizada no frontend; o modal de criação usa hora local e sugere título com base no paciente.

## Problemas Comuns

- `google.script.run` indisponível: acesse pela URL do Web App (não funciona em arquivo local).
- Pop‑up bloqueado nos relatórios: permita pop‑ups no domínio do Web App.
- Calendar não sincroniza: verifique escopos/autorizações e se a implantação executa “como o usuário que acessa o app”.

---

Sinta‑se à vontade para abrir issues/sugestões.
