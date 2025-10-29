# Fisio System – Web App (Google Apps Script)

Projeto de prontuário e relatórios em Google Apps Script (HTML Service) para clínicas de fisioterapia. O app oferece cadastro de pacientes, registro de atendimentos (vitals/nota SOAP) e geração de relatórios padronizados diretamente no Google Docs.

## Visão Geral

- Frontend em HTML/CSS/JS servido pelo HTML Service.
- Backend em Google Apps Script (Apps Script) com integração ao Google Drive/Docs.
- Relatórios gerados diretamente no Google Docs (fluxo “Docs-only”): o documento abre em uma nova aba para visualizar, imprimir e baixar no formato desejado (PDF, DOCX etc.).

## Funcionalidades

- Pacientes: cadastro, edição, status e listagem com busca.
- Atendimentos: abertura, sinais vitais, notas SOAP, encerramento e histórico.
- Profissionais: cadastro rápido durante o fluxo de atendimento.
- Relatórios (aba “Relatórios”):
  - Ficha de Avaliação
  - Evolução Clínica (com comparativos)
  - Relatório de Alta
- UI responsiva, com feedback visual e validações básicas.

## Estrutura do Projeto

- `index.html` — página principal do Web App (views e abinhas). Inclui o JS via `<?!= include('index.js'); ?>`.
- `index.js.html` — JavaScript do frontend (carregamento de dados, UI, atendimentos e geração de relatórios). Contém também as funções de construção de HTML da ficha para impressão local (hoje não utilizadas por padrão).
- `report.gs` — backend de relatórios (coleta de dados, montagem de documento Google Docs, funções utilitárias de formatação e helpers).
- `router.gs`, `code.gs` — endpoints utilitários (ex.: `getFrontendPatients`, helpers de include/rota e validações de acesso). Podem variar conforme sua base.
- `ficha-avaliacao.html` — template legacy de ficha para imprimir (mantido como referência).

Obs.: Alguns nomes podem variar levemente conforme sua base; os caminhos acima refletem os arquivos comuns encontrados neste projeto.

## Requisitos

- Conta Google com acesso ao Google Drive e Google Docs.
- Permissões Apps Script para: DocumentApp, DriveApp, PropertiesService (se usar armazenamento), e HtmlService.
- Navegador com pop‑ups habilitados para o domínio do Web App (necessário para abrir o Doc em nova aba).

## Configuração (Apps Script)

1) Crie um novo projeto Apps Script (script standalone).
2) Copie os arquivos do projeto para o editor do Apps Script (mantenha as mesmas extensões e nomes):
   - `index.html`, `index.js.html`
   - `report.gs`, `router.gs`, `code.gs` (e quaisquer outros `.gs` do backend)
   - `ficha-avaliacao.html` (opcional, legado)
3) Garanta que existe a função `include(filename)` no backend para permitir `<?!= include('...') ?>` no HTML. Caso não exista, adicione um helper:
   ```js
   function include(name) { return HtmlService.createTemplateFromFile(name).getRawContent(); }
   ```
4) Se quiser armazenar PDFs no Drive (fluxo opcional legado), configure a propriedade de script `STORAGE_ROOT_ID` com o ID da pasta raiz. No fluxo atual “Docs-only” isso NÃO é obrigatório.

## Deploy como Web App

1) No Apps Script, vá em Publicar → Implantar como aplicativo da web.
2) Defina a versão, quem pode acessar (por exemplo, “Qualquer pessoa com o link”) e salve.
3) Abra a URL do Web App. Importante: abrir o `index.html` localmente não funciona; o frontend usa `google.script.run` (só disponível quando carregado pelo Apps Script).

## Fluxo de Relatórios (Docs-only)

- Formato único: “Abrir no Google Docs”. O app chama o backend para gerar o documento e abre a URL do Doc em uma nova aba.
- Arquivo é salvo automaticamente pelo Google Docs no Drive (comportamento nativo). Você pode imprimir pelo navegador/Docs e baixar o formato desejado (PDF, DOCX, etc.).
- Principais funções backend:
  - `generateReportData(params)` — agrega paciente + atendimentos (com filtro de período quando aplicável).
  - `createReportDocument(data, type)` — roteia para o construtor certo.
  - `buildAvaliacaoDocument(body, data)` — Ficha de Avaliação.
  - `buildEvolucaoDocument(body, data)` — Evolução Clínica (comparativos).
  - `buildAltaDocument(body, data)` — Relatório de Alta.
  - `generateDocsReport(params)` — cria o Doc e retorna `{ success, url, file_id, file_name }`.

## Uso

1) Acesse a aba “Relatórios”.
2) Escolha o tipo (Ficha de Avaliação, Evolução Clínica, Relatório de Alta).
3) Selecione o paciente (e período para Evolução, se desejar).
4) Clique em “Gerar Relatório”.
5) O relatório abre no Google Docs em uma nova aba.

## Campos e Dados Utilizados

- Paciente: `full_name`, `birth_date`, `sex`, `document_id`, `conditions_json`, `allergies_json`.
- Atendimentos: `started_at`, `location`, `type`, `notes[]` (SOAP: `subjective`, `objective`, `assessment`, `plan`, opcional `pain_scale`), `vitals[]` (`spo2`, `hr`, `rr`, `bp_sys`, `bp_dia`, `temp`), `professional_name`, `professional_crefito`, `procedures[]`.
- Contatos (opcional): lista em `Contacts` vinculada ao paciente; tentamos identificar “Médico responsável” por texto em `role/relation` contendo “med/méd/doctor`.

## Padrões de Estilo

- Cor única para títulos e seções: preto (`#000000`) para manter consistência entre os relatórios.
- Tabelas e divisórias (horizontal rules) criadas via API do Google Docs.

## Problemas Comuns

- `google.script.run` não disponível: certifique‑se de abrir via URL do Web App (Apps Script). Abrir o `index.html` localmente não funciona.
- Popup bloqueado: permita pop‑ups para o domínio do Web App; o Docs abre em uma nova aba.
- PDF em branco: o fluxo atual não exporta automaticamente para PDF; abra no Docs e salve como PDF.
- Dados ausentes em relatórios: verifique se há atendimentos/ notas/ vitais para o período escolhido.

## Desenvolvimento

- O frontend usa logs via `debugLog(...)` (console e painel flutuante opcional). Para alternar a visualização, utilize `toggleDebug()` se exposto na interface em sua versão.
- As funções de relatório no frontend chamam `generateDocsReport(params)`; se optar por reativar a exportação para PDF, reimplemente `generatePDFReport(params)` e ajuste o listener do formulário.
- Para organização/limpeza de Docs temporários, crie um job de limpeza (time-driven) que arquive/exclua documentos antigos conforme sua política interna.

## Segurança e Acesso

- Muitas operações exigem papeis: `requireRole(['FISIO','COORD','ADMIN'])` (veja sua implementação em `code.gs`/`router.gs`). Garanta que o usuário atual tenha autorização.
- Não inclua dados pessoais sensíveis no repositório (IDs reais de pasta, chaves, etc.).

## Roadmap (sugestões)

- Guardar “período” explicitamente dentro do documento gerado (cabeçalho das seções).
- Incluir médico responsável e contatos de forma estruturada (campos dedicados).
- Melhorias de layout (tabelas com mais colunas, quebras de página, cabeçalhos repetidos por página, etc.).

---

Se precisar, posso complementar com prints, GIF curto de uso e um script de implantação (clasp) para versionamento entre local e Apps Script.

