/**
 * ============================================================================
 * report.gs - Geração de Relatórios COMPLETA
 * VERSÃO ATUALIZADA com suporte a Ficha de Avaliação
 * ============================================================================
 */

/**
 * ✅ Gera dados completos para relatório
 */
function generateReportData(params) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  Logger.log('[generateReportData] Gerando relatório: ' + params.type);
  Logger.log('[generateReportData] Paciente: ' + params.patient_id);
  
  var patient = getById('Patients', params.patient_id);
  
  if (!patient) {
    throw new Error('Paciente não encontrado');
  }
  
  // Busca dados complementares
  var encounters = getPatientEncounters(params.patient_id);
  var contacts = listRecords('Contacts', { patient_id: params.patient_id });
  
  // Filtra por período (se fornecido)
  if (params.date_start && params.date_end) {
    encounters = encounters.filter(function(e) {
      var date = new Date(e.started_at);
      var start = new Date(params.date_start);
      var end = new Date(params.date_end);
      return date >= start && date <= end;
    });
  }
  
  var data = {
    patient: patient,
    encounters: encounters,
    contacts: contacts,
    generated_at: nowISO(),
    generated_by: Session.getActiveUser().getEmail()
  };
  
  Logger.log('[generateReportData] Dados gerados: ' + encounters.length + ' atendimentos');
  
  return data;
}

/**
 * ✅ Gera relatório PDF (Google Docs)
 */
function generatePDFReport(params) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  try {
    Logger.log('[generatePDFReport] Iniciando geração de PDF');
    
    // Gera dados
    var data = generateReportData(params);
    
    // Cria documento Google Docs
    var doc = createReportDocument(data, params.type);
    
    // Converte para PDF
    var pdfBlob = doc.getAs('application/pdf');
    pdfBlob.setName(getReportFileName(data.patient, params.type));
    
    // Salva no Drive
    var file = saveReportToStorage(pdfBlob, data.patient.id);
    
    // Registra no histórico
    logAudit('REPORT_GENERATED', 'Reports', file.getId(), {
      patient_id: data.patient.id,
      type: params.type
    });
    
    Logger.log('[generatePDFReport] PDF gerado: ' + file.getId());
    
    return {
      success: true,
      url: file.getUrl(),
      file_id: file.getId(),
      file_name: file.getName()
    };
    
  } catch (error) {
    Logger.log('[generatePDFReport] ERRO: ' + error.message);
    throw error;
  }
}

/**
 * ✅ Cria documento Google Docs com o relatório
 */
function createReportDocument(data, type) {
  var patient = data.patient;
  var docName = getReportFileName(patient, type);
  var doc = DocumentApp.create(docName);
  var body = doc.getBody();
  body.clear();

  if (type === 'evolucao') {
    buildEvolucaoDocument(body, data);
  } else if (type === 'alta') {
    buildAltaDocument(body, data);
  } else {
    buildAvaliacaoDocument(body, data);
  }

  return doc;
}

/**
 * Monta o documento de Alta
 */
function buildAltaDocument(body, data) {
  var patient = data.patient;
  var encounters = (data.encounters || []).slice();

  // Ordena por data
  encounters.sort(function(a, b) { return new Date(a.started_at) - new Date(b.started_at); });
  var firstEnc = encounters[0] || {};
  var lastEnc = encounters[encounters.length - 1] || {};
  var initNote = (firstEnc.notes && firstEnc.notes[0]) ? firstEnc.notes[0] : null;
  var lastNote = (lastEnc.notes && lastEnc.notes[0]) ? lastEnc.notes[0] : null;

  // Cabeçalho
  var header = body.appendParagraph('RELATÓRIO DE ALTA — FISIOTERAPIA');
  header.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  header.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  header.setBold(true);
  header.setForegroundColor('#000000');

  // 1. Identificação
  body.appendParagraph('');
  addSectionHeader(body, '1. Identificação');
  var t = body.appendTable();
  var r1 = t.appendTableRow();
  r1.appendTableCell('Paciente').setBold(true);
  r1.appendTableCell(patient.full_name || '-');
  r1.appendTableCell('Idade').setBold(true);
  r1.appendTableCell(String(calculateAgeBackend(patient.birth_date) || '-'));

  var r2 = t.appendTableRow();
  r2.appendTableCell('Sexo').setBold(true);
  r2.appendTableCell(patient.sex === 'M' ? 'Masculino' : (patient.sex === 'F' ? 'Feminino' : '-'));
  r2.appendTableCell('Documento').setBold(true);
  r2.appendTableCell(patient.document_id || '-');

  // Opcional: CID/Condição e Médico responsável a partir de contacts
  var cidText = (function() {
    try {
      var conds = safeJsonParse(patient.conditions_json, []);
      return Array.isArray(conds) && conds.length ? conds.join(', ') : '-';
    } catch (e) { return '-'; }
  })();
  var doctorName = '-';
  var doctorPhone = '';
  if (data.contacts && data.contacts.length) {
    for (var i = 0; i < data.contacts.length; i++) {
      var c = data.contacts[i] || {};
      var role = (c.role || c.relation || '').toString().toLowerCase();
      if (role.indexOf('med') >= 0 || role.indexOf('doctor') >= 0 || role.indexOf('méd') >= 0) {
        doctorName = c.full_name || c.name || '-';
        doctorPhone = c.phone || c.mobile || '';
        break;
      }
    }
  }
  var r3 = t.appendTableRow();
  r3.appendTableCell('CID / Condição').setBold(true);
  r3.appendTableCell(cidText);
  r3.appendTableCell('Médico resp.').setBold(true);
  r3.appendTableCell((doctorName || '-') + (doctorPhone ? '  ' + doctorPhone : ''));

  // 2. Motivo da Fisioterapia
  body.appendParagraph('');
  addSectionHeader(body, '2. Motivo da Fisioterapia');
  var q = initNote && initNote.subjective ? initNote.subjective : (lastNote && lastNote.subjective ? lastNote.subjective : 'Não informado');
  var objetivo = lastNote && lastNote.plan ? lastNote.plan : (initNote && initNote.plan ? initNote.plan : 'Não informado');
  body.appendParagraph('Queixa principal: ' + q);
  body.appendParagraph('Objetivo do tratamento: ' + objetivo);

  // 3. Conduta Fisioterapêutica
  body.appendParagraph('');
  addSectionHeader(body, '3. Conduta Fisioterapêutica');
  var procedures = (lastEnc.procedures || []).concat(firstEnc.procedures || []);
  if (procedures && procedures.length) {
    // Lista procedimentos únicos por descrição
    var seen = {};
    for (var p = 0; p < procedures.length; p++) {
      var desc = procedures[p] && (procedures[p].description || procedures[p].name);
      if (!desc) continue;
      var key = String(desc);
      if (seen[key]) continue;
      seen[key] = true;
      body.appendParagraph('• ' + desc);
    }
  } else {
    body.appendParagraph('Sem procedimentos registrados.');
  }

  // 4. Evolução e Resultados
  body.appendParagraph('');
  addSectionHeader(body, '4. Evolução e Resultados');
  var initV = (firstEnc.vitals && firstEnc.vitals[0]) ? firstEnc.vitals[0] : null;
  var lastV = (lastEnc.vitals && lastEnc.vitals[0]) ? lastEnc.vitals[0] : null;
  var comp = body.appendTable();
  var ch = comp.appendTableRow();
  ch.appendTableCell('Parâmetro').setBold(true);
  ch.appendTableCell('Inicial').setBold(true);
  ch.appendTableCell('Atual').setBold(true);
  ch.appendTableCell('Evolução').setBold(true);

  function addRow(name, iVal, lVal, unit) {
    if (!iVal && !lVal) return;
    var tr = comp.appendTableRow();
    tr.appendTableCell(name);
    tr.appendTableCell(iVal ? (iVal + (unit || '')) : '-');
    tr.appendTableCell(lVal ? (lVal + (unit || '')) : '-');
    if (iVal != null && lVal != null && !isNaN(Number(iVal)) && !isNaN(Number(lVal))) {
      var d = Number(lVal) - Number(iVal);
      var sign = d > 0 ? '+' : '';
      tr.appendTableCell(sign + d + (unit || ''));
    } else {
      tr.appendTableCell('-');
    }
  }

  if (initV || lastV) {
    addRow('SpO₂ (%)', initV && initV.spo2, lastV && lastV.spo2, '%');
    addRow('FC (bpm)', initV && initV.hr, lastV && lastV.hr, ' bpm');
    addRow('FR (ipm)', initV && initV.rr, lastV && lastV.rr, ' ipm');
    // PA como texto
    var paInit = (initV && (initV.bp_sys || initV.bp_dia)) ? ((initV.bp_sys||'') + '/' + (initV.bp_dia||'')) : '';
    var paLast = (lastV && (lastV.bp_sys || lastV.bp_dia)) ? ((lastV.bp_sys||'') + '/' + (lastV.bp_dia||'')) : '';
    var trPA = comp.appendTableRow();
    trPA.appendTableCell('PA (mmHg)');
    trPA.appendTableCell(paInit || '-');
    trPA.appendTableCell(paLast || '-');
    trPA.appendTableCell('-');
    addRow('Temp (°C)', initV && initV.temp, lastV && lastV.temp, '°C');
  } else {
    body.appendParagraph('Sem dados de sinais vitais para comparação.');
  }

  // 5. Alta e Recomendações
  body.appendParagraph('');
  addSectionHeader(body, '5. Alta e Recomendações');
  var altaTxt = '';
  if ((lastEnc.type || '').toString().toUpperCase() === 'ALTA') {
    altaTxt = 'Alta concedida no atendimento de ' + formatDate(lastEnc.started_at) + '.';
  }
  var recTxt = (lastNote && lastNote.plan) ? ('Recomendações: ' + lastNote.plan) : 'Sem recomendações adicionais.';
  body.appendParagraph(altaTxt || '');
  body.appendParagraph(recTxt);

  // Assinatura
  body.appendParagraph('');
  var footer = body.appendParagraph('_'.repeat(50));
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Fisioterapeuta Responsável').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  if (lastEnc) {
    body.appendParagraph(lastEnc.professional_name || '').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('CREFITO: ' + (lastEnc.professional_crefito || '')).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  }
  body.appendParagraph('');
  body.appendParagraph('Data: ' + formatDate(new Date())).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}

/**
 * Monta o documento de Ficha de Avaliação
 */
function buildAvaliacaoDocument(body, data) {
  var patient = data.patient;
  var encounters = data.encounters || [];

  // Cabeçalho
  var header = body.appendParagraph('FICHA DE AVALIAÇÃO');
  header.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  header.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  header.setBold(true);
  header.setForegroundColor('#000000');

  body.appendParagraph(''); // Espaço

  // Dados Pessoais
  addSectionHeader(body, 'Dados Pessoais do Paciente');

  var table = body.appendTable();
  addTableRow(table, 'Nome:', patient.full_name);
  addTableRow(table, 'Data de Nascimento:', formatDate(patient.birth_date));
  addTableRow(table, 'Idade:', calculateAgeBackend(patient.birth_date) + ' anos');
  addTableRow(table, 'Sexo:', patient.sex === 'M' ? 'Masculino' : 'Feminino');
  addTableRow(table, 'CPF:', patient.document_id || '');

  body.appendParagraph(''); // Espaço

  // Diagnóstico Clínico
  addSectionHeader(body, 'Diagnóstico Clínico');

  if (encounters.length > 0 && encounters[0].notes && encounters[0].notes.length > 0) {
    var lastNote = encounters[0].notes[0];
    body.appendParagraph(lastNote.assessment || 'Não informado');
  } else {
    body.appendParagraph('Não informado');
  }

  body.appendParagraph(''); // Espaço

  // Anamnese
  addSectionHeader(body, 'Anamnese');

  body.appendParagraph('Queixa Principal:').setBold(true);
  if (encounters.length > 0 && encounters[0].notes && encounters[0].notes.length > 0) {
    var lastNote2 = encounters[0].notes[0];
    body.appendParagraph(lastNote2.subjective || 'Não informado');
  } else {
    body.appendParagraph('Não informado');
  }

  body.appendParagraph(''); // Espaço

  body.appendParagraph('Doenças Associadas:').setBold(true);
  var conditions = safeJsonParse(patient.conditions_json, []);
  if (conditions.length > 0) {
    body.appendParagraph(conditions.join(', '));
  } else {
    body.appendParagraph('Nenhuma condição registrada');
  }

  body.appendParagraph(''); // Espaço

  // Alergias
  addSectionHeader(body, 'Alergias');
  var allergies = safeJsonParse(patient.allergies_json, []);
  if (allergies.length > 0) {
    body.appendParagraph(allergies.join(', '));
  } else {
    body.appendParagraph('Nenhuma alergia registrada');
  }

  body.appendParagraph(''); // Espaço
  body.appendParagraph(''); // Espaço

  // Histórico de Atendimentos
  if (encounters.length > 0) {
    addSectionHeader(body, 'Histórico de Atendimentos (' + encounters.length + ' atendimento(s))');

    encounters.forEach(function(enc, index) {
      body.appendParagraph('').appendText('Atendimento ' + (index + 1) + ':').setBold(true);
      body.appendParagraph('Data: ' + formatDate(enc.started_at));
      body.appendParagraph('Local: ' + (enc.location || '-'));
      body.appendParagraph('Tipo: ' + (enc.type || '-'));

      if (enc.notes && enc.notes.length > 0) {
        body.appendParagraph('Evolução: ' + (enc.notes[0].objective || ''));
      }

      body.appendParagraph(''); // Espaço
    });
  }

  // Rodapé
  body.appendParagraph(''); // Espaço
  body.appendParagraph(''); // Espaço

  var footer = body.appendParagraph('_'.repeat(50));
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('Fisioterapeuta Responsável').setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  if (encounters.length > 0) {
    body.appendParagraph(encounters[0].professional_name || '').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('CREFITO: ' + (encounters[0].professional_crefito || '')).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  }

  body.appendParagraph(''); // Espaço
  body.appendParagraph('Data: ' + formatDate(new Date())).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}

/**
 * Monta o documento de Evolução Clínica
 */
function buildEvolucaoDocument(body, data) {
  var patient = data.patient;
  var encounters = (data.encounters || []).slice();

  // Ordena por data (ascendente)
  encounters.sort(function(a, b) {
    return new Date(a.started_at) - new Date(b.started_at);
  });

  // Cabeçalho
  var header = body.appendParagraph('RELATÓRIO DE EVOLUÇÃO CLÍNICA — FISIOTERAPIA');
  header.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  header.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  header.setBold(true);
  header.setForegroundColor('#000000');

  // Bloco informativo (paciente/sexo/diagnóstico/profissional)
  body.appendParagraph('');
  var summary = body.appendTable();
  var sex = patient.sex === 'M' ? 'M' : (patient.sex === 'F' ? 'F' : '-');
  var lastEnc = encounters.length > 0 ? encounters[encounters.length - 1] : {};
  var firstEnc = encounters.length > 0 ? encounters[0] : {};
  var lastNote = (lastEnc && lastEnc.notes && lastEnc.notes[0]) ? lastEnc.notes[0] : null;

  var row1 = summary.appendTableRow();
  row1.appendTableCell('Paciente:').setBold(true);
  row1.appendTableCell(patient.full_name || '-');
  row1.appendTableCell('Sexo:').setBold(true);
  row1.appendTableCell(sex);

  var row2 = summary.appendTableRow();
  row2.appendTableCell('Diagnóstico clínico:').setBold(true);
  row2.appendTableCell((lastNote && lastNote.assessment) ? lastNote.assessment : 'Não informado');
  row2.appendTableCell('Profissional responsável:').setBold(true);
  row2.appendTableCell(((lastEnc && lastEnc.professional_name) ? lastEnc.professional_name : '-') +
                      (lastEnc && lastEnc.professional_crefito ? ' — CREFITO: ' + lastEnc.professional_crefito : ''));

  // Se não houver atendimentos, encerra com aviso
  if (encounters.length === 0) {
    body.appendParagraph('');
    body.appendParagraph('Nenhum atendimento encontrado para o período selecionado.');
    return;
  }

  // 1. Dados de Identificação
  body.appendParagraph('');
  addSectionHeader(body, '1. Dados de Identificação');
  var ident = body.appendTable();
  var r1 = ident.appendTableRow();
  r1.appendTableCell('Nome completo').setBold(true);
  r1.appendTableCell(patient.full_name || '-');
  r1.appendTableCell('Idade').setBold(true);
  r1.appendTableCell(String(calculateAgeBackend(patient.birth_date) || '-'));
  var r2 = ident.appendTableRow();
  r2.appendTableCell('Sexo').setBold(true);
  r2.appendTableCell(sex);
  r2.appendTableCell('Documento').setBold(true);
  r2.appendTableCell(patient.document_id || '-');

  // 2. Avaliação Inicial
  body.appendParagraph('');
  addSectionHeader(body, '2. Avaliação Inicial');
  var initNote = (firstEnc && firstEnc.notes && firstEnc.notes[0]) ? firstEnc.notes[0] : null;
  if (initNote) {
    body.appendParagraph('Queixa principal: ' + (initNote.subjective || '-'));
    if (initNote.objective) body.appendParagraph('Objetivo: ' + initNote.objective);
  } else {
    body.appendParagraph('Sem registro de avaliação inicial.');
  }
  // vitais iniciais
  if (firstEnc && firstEnc.vitals && firstEnc.vitals[0]) {
    var iv = firstEnc.vitals[0];
    var vtInit = body.appendTable();
    var hv = vtInit.appendTableRow();
    hv.appendTableCell('Parâmetro').setBold(true);
    hv.appendTableCell('Valor Inicial').setBold(true);
    var arrInit = [];
    if (iv.spo2) arrInit.push(['SpO₂', iv.spo2 + '%']);
    if (iv.hr) arrInit.push(['FC', iv.hr + ' bpm']);
    if (iv.rr) arrInit.push(['FR', iv.rr + ' ipm']);
    if (iv.bp_sys || iv.bp_dia) arrInit.push(['PA', (iv.bp_sys||'') + '/' + (iv.bp_dia||'') + ' mmHg']);
    if (iv.temp) arrInit.push(['Temp', iv.temp + '°C']);
    arrInit.forEach(function(row){
      var tr = vtInit.appendTableRow();
      tr.appendTableCell(row[0]);
      tr.appendTableCell(row[1]);
    });
  }

  // 3. Evolução Clínica (comparativo inicial x atual)
  body.appendParagraph('');
  addSectionHeader(body, '3. Evolução Clínica');
  var lv = (lastEnc && lastEnc.vitals && lastEnc.vitals[0]) ? lastEnc.vitals[0] : null;
  var comp = body.appendTable();
  var ch = comp.appendTableRow();
  ch.appendTableCell('Parâmetro').setBold(true);
  ch.appendTableCell('Avaliação Inicial').setBold(true);
  ch.appendTableCell('Avaliação Atual').setBold(true);
  ch.appendTableCell('Evolução / Resultado').setBold(true);

  function addCompRow(name, initVal, lastVal, transform) {
    if (!initVal && !lastVal) return;
    var tr = comp.appendTableRow();
    tr.appendTableCell(name);
    tr.appendTableCell(initVal || '-');
    tr.appendTableCell(lastVal || '-');
    var evo = '-';
    if (transform) evo = transform(initVal, lastVal);
    tr.appendTableCell(evo);
  }

  function deltaUnit(init, last, unit) {
    var ni = Number(String(init).replace(/[^0-9.-]/g, ''));
    var nl = Number(String(last).replace(/[^0-9.-]/g, ''));
    if (isNaN(ni) || isNaN(nl)) return '-';
    var d = nl - ni;
    var sign = d > 0 ? '+' : '';
    return sign + d + (unit || '');
  }

  var initV = (firstEnc && firstEnc.vitals && firstEnc.vitals[0]) ? firstEnc.vitals[0] : null;
  addCompRow('Dor (EVA)', (initNote && initNote.pain_scale) ? String(initNote.pain_scale) : null,
             (lastNote && lastNote.pain_scale) ? String(lastNote.pain_scale) : null,
             function(i,l){ if(i!=null&&l!=null){return deltaUnit(i,l,'');} return '-'; });
  addCompRow('SpO₂ (%)', initV && initV.spo2 ? initV.spo2 + '%' : null, lv && lv.spo2 ? lv.spo2 + '%' : null,
             function(i,l){ return deltaUnit(i,l,'%'); });
  addCompRow('FC (bpm)', initV && initV.hr ? initV.hr + ' bpm' : null, lv && lv.hr ? lv.hr + ' bpm' : null,
             function(i,l){ return deltaUnit(i,l,' bpm'); });
  addCompRow('FR (ipm)', initV && initV.rr ? initV.rr + ' ipm' : null, lv && lv.rr ? lv.rr + ' ipm' : null,
             function(i,l){ return deltaUnit(i,l,' ipm'); });
  addCompRow('PA (mmHg)', initV && (initV.bp_sys||initV.bp_dia) ? (initV.bp_sys||'') + '/' + (initV.bp_dia||'') : null,
             lv && (lv.bp_sys||lv.bp_dia) ? (lv.bp_sys||'') + '/' + (lv.bp_dia||'') : null,
             function(i,l){ return '-'; });
  addCompRow('Temp (°C)', initV && initV.temp ? initV.temp + '°C' : null, lv && lv.temp ? lv.temp + '°C' : null,
             function(i,l){ return deltaUnit(i,l,'°C'); });

  // 4. Considerações Finais (usa última avaliação/planejamento)
  body.appendParagraph('');
  addSectionHeader(body, '4. Considerações Finais');
  if (lastNote && (lastNote.assessment || lastNote.plan)) {
    if (lastNote.assessment) body.appendParagraph(lastNote.assessment);
    if (lastNote.plan) body.appendParagraph('Plano: ' + lastNote.plan);
  } else {
    body.appendParagraph('Sem considerações registradas.');
  }

  // Rodapé (profissional do último atendimento)
  body.appendParagraph('');
  var footer = body.appendParagraph('_'.repeat(50));
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Fisioterapeuta Responsável').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  if (lastEnc) {
    body.appendParagraph(lastEnc.professional_name || '').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph('CREFITO: ' + (lastEnc.professional_crefito || '')).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  }
  body.appendParagraph('');
  body.appendParagraph('Data: ' + formatDate(new Date())).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}

/**
 * Helper: Adiciona cabeçalho de seção
 */
function addSectionHeader(body, text) {
  var header = body.appendParagraph(text);
  header.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  header.setBold(true);
  header.setForegroundColor('#000000');
  
  // Linha horizontal
  var line = body.appendHorizontalRule();
}

/**
 * Helper: Adiciona linha na tabela
 */
function addTableRow(table, label, value) {
  var row = table.appendTableRow();
  var labelCell = row.appendTableCell(label);
  labelCell.setBold(true);
  labelCell.setWidth(150);
  
  var valueCell = row.appendTableCell(value || '');
  valueCell.setWidth(350);
  
  return row;
}

/**
 * Helper: Formata data
 */
function formatDate(dateStr) {
  if (!dateStr) return '__/__/____';
  
  try {
    var date = new Date(dateStr);
    var day = ('0' + date.getDate()).slice(-2);
    var month = ('0' + (date.getMonth() + 1)).slice(-2);
    var year = date.getFullYear();
    return day + '/' + month + '/' + year;
  } catch (e) {
    return '__/__/____';
  }
}

/**
 * Helper: Calcula idade (backend)
 */
function calculateAgeBackend(birthDate) {
  if (!birthDate) return 0;
  
  try {
    var today = new Date();
    var birth = new Date(birthDate);
    var age = today.getFullYear() - birth.getFullYear();
    var md = today.getMonth() - birth.getMonth();
    
    if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  } catch (e) {
    return 0;
  }
}

/**
 * Helper: Nome do arquivo
 */
function getReportFileName(patient, type) {
  var typeNames = {
    'avaliacao': 'Ficha de Avaliacao',
    'evolucao': 'Evolucao Clinica',
    'alta': 'Relatorio de Alta'
  };
  
  var typeName = typeNames[type] || 'Relatorio';
  var patientName = patient.full_name.replace(/[^a-zA-Z0-9]/g, '_');
  var timestamp = Utilities.formatDate(new Date(), 'GMT-3', 'yyyyMMdd_HHmmss');
  
  return typeName + '_' + patientName + '_' + timestamp;
}

/**
 * Helper: Salva relatório no Drive
 */
function saveReportToStorage(blob, patientId) {
  try {
    var storageId = PropertiesService.getScriptProperties().getProperty('STORAGE_ROOT_ID');
    var root = DriveApp.getFolderById(storageId);
    
    // Pasta de relatórios
    var reportsFolder = getOrCreateFolder(root, '06-Reports');
    
    // Pasta do paciente
    var patientFolder = getOrCreateFolder(reportsFolder, patientId);
    
    // Salva arquivo
    var file = patientFolder.createFile(blob);
    
    Logger.log('[saveReportToStorage] Relatório salvo: ' + file.getId());
    
    return file;
    
  } catch (error) {
    Logger.log('[saveReportToStorage] ERRO: ' + error.message);
    throw error;
  }
}

/**
 * ✅ Lista relatórios gerados de um paciente
 */
function getPatientReports(patientId) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  try {
    var storageId = PropertiesService.getScriptProperties().getProperty('STORAGE_ROOT_ID');
    var root = DriveApp.getFolderById(storageId);
    
    var reportsFolder = getOrCreateFolder(root, '06-Reports');
    var patientFolder = getOrCreateFolder(reportsFolder, patientId);
    
    var files = [];
    var fileIterator = patientFolder.getFiles();
    
    while (fileIterator.hasNext()) {
      var file = fileIterator.next();
      files.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl(),
        created_at: file.getDateCreated().toISOString(),
        size: file.getSize()
      });
    }
    
    // Ordena por data (mais recente primeiro)
    files.sort(function(a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    return files;
    
  } catch (error) {
    Logger.log('[getPatientReports] ERRO: ' + error.message);
    return [];
  }
}

/**
 * Gera apenas o documento Google Docs e retorna a URL.
 * Não exporta para PDF nem salva cópia adicional.
 */
function generateDocsReport(params) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  try {
    Logger.log('[generateDocsReport] Iniciando geração de documento (Docs-only)');
    var data = generateReportData(params);
    var doc = createReportDocument(data, params.type);
    doc.saveAndClose();
    return {
      success: true,
      url: doc.getUrl(),
      file_id: doc.getId(),
      file_name: doc.getName(),
      kind: 'google-docs'
    };
  } catch (error) {
    Logger.log('[generateDocsReport] ERRO: ' + error.message);
    throw error;
  }
}

