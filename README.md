# Fisio System - Web App (Google Apps Script)

Projeto de prontuário e relatórios em Google Apps Script (HTML Service) para clínicas de fisioterapia. O app oferece cadastro de pacientes, registro de atendimentos (sinais vitais e nota SOAP) e geração de relatórios padronizados diretamente no Google Docs.

## Visão Geral

- Frontend em HTML/CSS/JS servido pelo HTML Service.
- Backend em Google Apps Script com integração ao Google Drive/Docs.
- Relatórios gerados diretamente no Google Docs (fluxo "Docs-only"): o documento abre em nova aba para visualizar, imprimir e baixar (PDF, DOCX etc.).

## Funcionalidades

- Pacientes: cadastro/edição, status e listagem com busca.
- Atendimentos: abertura, sinais vitais, notas SOAP, encerramento e histórico.
- Profissionais: cadastro rápido durante o fluxo de atendimento.
- Relatórios (aba "Relatórios"):
  - Ficha de Avaliação
  - Evolução Clínica (comparativos)
  - Relatório de Alta

## Estrutura do Projeto

- `index.html` — página principal do Web App (views e abas). Inclui o JS via `<?!= include('index.js'); ?>`.
- `index.js.html` — JavaScript do frontend (carregamento de dados, UI, atendimentos e geração de relatórios).
- `report.gs` — backend de relatórios (coleta de dados, montagem de documento Google Docs, helpers).
- `router.gs`, `code.gs` — endpoints/utilitários (ex.: `getFrontendPatients`, helpers include/rota, permissões).
- `ficha-avaliacao.html` — template legado de impressão (referência).

## Requisitos

- Conta Google com acesso ao Google Drive e Google Docs.
- Permissões Apps Script: DocumentApp, DriveApp, PropertiesService (se usar storage) e HtmlService.
- Pop‑ups habilitados para o domínio do Web App (Docs abre em nova aba).

## Configuração (Apps Script)

1) Crie um projeto Apps Script (standalone).
2) Copie os arquivos para o editor (mesmos nomes/extensões).
3) Garanta a função `include(name)` no backend:
   ```js
   function include(name) { return HtmlService.createTemplateFromFile(name).getRawContent(); }
   ```
4) Se optar por armazenar PDFs (legado), configure `STORAGE_ROOT_ID`. No fluxo atual (Docs‑only) não é obrigatório.

## Deploy como Web App

1) Publicar → Implantar como aplicativo da web.
2) Defina a versão e quem pode acessar (ex.: "Qualquer pessoa com o link").
3) Use a URL do Web App para acesso (necessário para `google.script.run`).

## Fluxo de Relatórios (Docs‑only)

- Formato único: "Abrir no Google Docs".
- O backend cria o Doc e retorna a URL para abrir na nova aba.
- Funções principais (backend):
  - `generateReportData(params)` — agrega paciente + atendimentos (com filtro de período).
  - `createReportDocument(data, type)` — roteia para o construtor do tipo.
  - `buildAvaliacaoDocument(body, data)` — Ficha de Avaliação.
  - `buildEvolucaoDocument(body, data)` — Evolução Clínica.
  - `buildAltaDocument(body, data)` — Relatório de Alta.
  - `generateDocsReport(params)` — retorna `{ success, url, file_id, file_name }`.

## Uso

1) Aba "Relatórios" → escolha o tipo.
2) Selecione o paciente (e período para Evolução, se necessário).
3) Clique em "Gerar Relatório" → abre no Google Docs.

## Dados Utilizados

- Paciente: `full_name`, `birth_date`, `sex`, `document_id`, `conditions_json`, `allergies_json`.
- Atendimentos: `started_at`, `location`, `type`, `notes[]` (SOAP: `subjective`, `objective`, `assessment`, `plan`, `pain_scale` opcional), `vitals[]` (`spo2`, `hr`, `rr`, `bp_sys`, `bp_dia`, `temp`), `professional_name`, `professional_crefito`, `procedures[]`.
- Contatos (opcional): `Contacts` vinculados ao paciente; tentativa de detectar médico responsável por `role/relation`.

## Problemas Comuns

- `google.script.run` indisponível: abra via URL do Web App.
- Pop‑up bloqueado: permita pop‑ups para abrir o Google Docs.
- PDF vazio: fluxo atual não exporta PDF automaticamente; salve pelo Docs.

## Roadmap (sugestões)

- Exibir período selecionado dentro do Doc.
- Campos dedicados para médico/contatos.
- Tabelas com mais colunas e cabeçalhos de página.

---

Sinta‑se à vontade para abrir issues/sugestões.

