/**
 * ============================================================================
 * router.gs - Gerenciamento de Rotas e API
 * VERSÃO CORRIGIDA - Detalhes de Atendimento
 * ============================================================================
 */

/**
 * Handler para GET API (retorna objeto JS)
 */
function handleApiGet(e) {
  var params = (e && e.parameter) ? e.parameter : (e || {});
  var path = params.path ? String(params.path).toLowerCase() : '';
  
  Logger.log('[handleApiGet] ===== NOVA REQUISIÇÃO =====');
  Logger.log('[handleApiGet] Path: ' + path);
  Logger.log('[handleApiGet] Params completos: ' + JSON.stringify(params));
  
  try {
    switch(path) {
      case '/api/user':
        Logger.log('[handleApiGet] Rota: getCurrentUser');
        var user = getCurrentUser();
        Logger.log('[handleApiGet] User obtido: ' + JSON.stringify(user));
        return user;
      
      case '/api/patients':
        Logger.log('[handleApiGet] Rota: patients');
        
        if (params.id) {
          var patient = getById('Patients', params.id);
          return { data: patient };
        }
        
        var all = listRecords('Patients');
        if (!Array.isArray(all)) {
          Logger.log('[handleApiGet] listRecords retornou não-array');
          return { data: [] };
        }
        
        var active = [];
        for (var i = 0; i < all.length; i++) {
          var p = all[i];
          var status = (p && p.status) ? String(p.status).trim().toUpperCase() : '';
          if (status === '' || status === 'ACTIVE') {
            active.push(p);
          }
        }
        
        Logger.log('[handleApiGet] Retornando ' + active.length + ' pacientes ativos');
        return { data: active };
      
      case '/api/patients/contacts':
        Logger.log('[handleApiGet] Rota: patients/contacts');
        var contacts = listRecords('Contacts', { patient_id: params.patient_id });
        return { data: contacts };

      case '/api/patients/status':
        if (!body.patient_id || !body.status) {
          return { error: 'patient_id e status são obrigatórios' };
        }
        
        var statusChanged = changePatientStatus(
          body.patient_id, 
          body.status, 
          body.notes || ''
        );
        
        return { success: statusChanged };

      // ✅ NOVO ENDPOINT: Contagem de pacientes por status
      case '/api/patients/status/count':
        var counts = countPatientsByStatus();
        return { success: true, data: counts };

      // ✅ NOVO ENDPOINT: Lista pacientes por status
      case '/api/patients/by-status':
        if (!body.status) {
          return { error: 'status é obrigatório' };
        }
        
        var patientsByStatus = getPatientsByStatus(body.status);
        return { success: true, data: patientsByStatus };
      
      case '/api/encounters':
        Logger.log('[handleApiGet] Rota: encounters');
        
        if (params.id) {
          var encounter = getById('Encounters', params.id);
          return { data: encounter };
        }
        if (params.patient_id) {
          var encs = listRecords('Encounters', { patient_id: params.patient_id });
          return { data: encs };
        }
        return { error: 'Parâmetros insuficientes' };
      
      case '/api/assessments/templates':
        Logger.log('[handleApiGet] Rota: assessments/templates');
        var templates = getAssessmentTemplate(params.tool);
        return { data: templates };
      
      case '/api/professionals':
        Logger.log('[handleApiGet] Rota: professionals');
        var professionals = listRecords('Professionals', { status: 'ACTIVE' });
        return { data: professionals };
      
      case '/api/encounters/patient':
        Logger.log('[handleApiGet] Rota: encounters/patient');
        
        if (!params.patient_id) {
          Logger.log('[handleApiGet] ERRO: patient_id ausente');
          return { error: 'patient_id obrigatório' };
        }
        
        var encounters = getPatientEncounters(params.patient_id);
        return { data: encounters };

      case '/api/encounters/details':
        Logger.log('[handleApiGet] ===== DETALHES DO ATENDIMENTO =====');
        Logger.log('[handleApiGet] Params recebidos: ' + JSON.stringify(params));
        
        // ✅ ACEITA 'id' OU 'encounter_id'
        var encounterId = params.id || params.encounter_id;
        
        if (!encounterId) {
          Logger.log('[handleApiGet] ❌ ERRO: ID não fornecido');
          return { error: 'ID obrigatório', data: null };
        }
        
        Logger.log('[handleApiGet] 🔍 Buscando encounter ID: ' + encounterId);
        Logger.log('[handleApiGet] Tipo do ID: ' + typeof encounterId);
        
        try {
          // ✅ CHAMA A FUNÇÃO CORRETA
          Logger.log('[handleApiGet] Chamando getEncounterDetails...');
          var details = getEncounterDetails(encounterId);
          
          // ✅ VALIDAÇÃO DETALHADA
          Logger.log('[handleApiGet] Resposta de getEncounterDetails:');
          Logger.log('[handleApiGet] - Tipo: ' + typeof details);
          Logger.log('[handleApiGet] - É null?: ' + (details === null));
          Logger.log('[handleApiGet] - É undefined?: ' + (details === undefined));
          
          if (!details) {
            Logger.log('[handleApiGet] ❌ getEncounterDetails retornou null/undefined');
            return { error: 'Atendimento não encontrado', data: null };
          }
          
          // ✅ LOG DA ESTRUTURA
          Logger.log('[handleApiGet] ✅ Detalhes obtidos:');
          Logger.log('[handleApiGet] - encounter: ' + (details.encounter ? 'OK' : 'NULL'));
          Logger.log('[handleApiGet] - patient: ' + (details.patient ? 'OK' : 'NULL'));
          Logger.log('[handleApiGet] - professional: ' + (details.professional ? 'OK' : 'NULL'));
          Logger.log('[handleApiGet] - notes: ' + (details.notes ? details.notes.length : 0));
          Logger.log('[handleApiGet] - vitals: ' + (details.vitals ? details.vitals.length : 0));
          Logger.log('[handleApiGet] - assessments: ' + (details.assessments ? details.assessments.length : 0));
          Logger.log('[handleApiGet] - procedures: ' + (details.procedures ? details.procedures.length : 0));
          
          // ✅ RETORNA ESTRUTURA CORRETA
          Logger.log('[handleApiGet] ✅ Retornando dados válidos');
          return { success: true, data: details };
          
        } catch (error) {
          Logger.log('[handleApiGet] ❌ EXCEÇÃO em getEncounterDetails:');
          Logger.log('[handleApiGet] - Message: ' + error.message);
          Logger.log('[handleApiGet] - Stack: ' + error.stack);
          return { error: error.message, data: null };
        }
      
      default:
        Logger.log('[handleApiGet] ⚠️ Rota não encontrada: ' + path);
        return { error: 'Rota não encontrada: ' + path };
    }
    
  } catch (error) {
    Logger.log('[handleApiGet] ❌ ERRO CRÍTICO NO ROUTER:');
    Logger.log('[handleApiGet] - Message: ' + error.message);
    Logger.log('[handleApiGet] - Stack: ' + error.stack);
    return { error: 'Erro interno: ' + error.message };
  }
}

/**
 * Handler para POST API (retorna objeto JS)
 */
function handleApiPost(path, body) {
  Logger.log('[handleApiPost] Path: ' + path);
  
  switch(path) {
    case '/api/patients':
      if (body.id) {
        var updated = updatePatient(body.id, body);
        return { success: updated, data: body };
      }
      var patient = createPatient(body);
      return { success: true, data: patient };
    
    case '/api/patients/contacts':
      var contact = addContact(body.patient_id, body);
      return { success: true, data: contact };
    
    case '/api/encounters/open':
      var encounter = openEncounter(body);
      return { success: true, data: encounter };
    
    case '/api/encounters/close':
      var closed = closeEncounter(body.encounter_id);
      return { success: closed };
    
    case '/api/encounters/note':
      var note = addSessionNote(body);
      return { success: true, data: note };
    
    case '/api/vitals':
      var vitals = recordVitals(body);
      return { success: true, data: vitals };
    
    case '/api/assessments':
      var assessment = recordAssessment(body);
      return { success: true, data: assessment };
    
    case '/api/goals':
      var goal = {
        id: uuid(),
        patient_id: body.patient_id,
        description: body.description,
        criteria: body.criteria,
        due_date: body.due_date,
        status: 'PENDING'
      };
      appendRow('Goals', goal);
      logAudit('CREATE', 'Goals', goal.id);
      return { success: true, data: goal };
    
    case '/api/consents':
      var consent = {
        id: uuid(),
        patient_id: body.patient_id,
        scope: body.scope,
        basis: 'Assistência à saúde',
        granted_at: nowISO(),
        revoked_at: '',
        doc_file_id: body.doc_file_id || ''
      };
      appendRow('Consents', consent);
      logAudit('CREATE', 'Consents', consent.id);
      return { success: true, data: consent };
    
    case '/api/professionals':
      var newProf = {
        id: uuid(),
        full_name: body.full_name,
        crefito: body.crefito || '',
        role: body.role,
        email: body.email,
        status: body.status || 'ACTIVE'
      };
      
      appendRow('Professionals', newProf);
      logAudit('CREATE', 'Professionals', newProf.id);
      
      return { success: true, data: newProf };
    
    case '/api/professionals/update':
      var profUpdated = updateRecord('Professionals', body.id, {
        full_name: body.full_name,
        crefito: body.crefito || '',
        role: body.role,
        email: body.email,
        status: body.status || 'ACTIVE'
      });
      
      if (profUpdated) {
        logAudit('UPDATE', 'Professionals', body.id);
      }
      
      return { success: profUpdated, data: body };

    case '/api/encounters/update':
      var updated = updateEncounter(body.encounter_id, body);
      return { success: updated };

    case '/api/encounters/delete':
      var deleted = deleteEncounter(body.encounter_id);
      return { success: deleted };

    case '/api/reports/patient':
      if (!params.patient_id) {
        return { error: 'patient_id obrigatório' };
      }
      
      var patientReports = getPatientReports(params.patient_id);
      return { success: true, data: patientReports };


    /**
    * ADICIONE estes cases no handleApiPost:
    */

    case '/api/reports/generate':
      var reportData = generateReportData(body);
      return { success: true, data: reportData };

    case '/api/reports/pdf':
      var pdfResult = generatePDFReport(body);
      return pdfResult;

    case '/api/reports/export-csv':
      if (!body.sheet_name) {
        return { error: 'sheet_name obrigatório' };
      }
      
      var csvUrl = exportToCSV(body.sheet_name, body.filter || {});
      
      if (csvUrl) {
        return { success: true, url: csvUrl };
      } else {
        return { error: 'Nenhum dado para exportar' };
      }
    
    default:
      return { error: 'Endpoint não encontrado' };
  }
}

/**
 * API SIMPLIFICADA - Retorna pacientes ativos
 */
function apiGetPatients() {
  try {
    Logger.log('[apiGetPatients] ===== INÍCIO =====');
    
    ensureSystemInitialized();
    
    var props = PropertiesService.getScriptProperties();
    var dbId = props.getProperty('DB_ID');
    Logger.log('[apiGetPatients] DB_ID: ' + dbId);
    
    if (!dbId) {
      Logger.log('[apiGetPatients] ERRO: DB_ID não configurado');
      return [];
    }
    
    var ss = null;
    try {
      ss = SpreadsheetApp.openById(dbId);
      Logger.log('[apiGetPatients] Planilha aberta: ' + ss.getName());
    } catch (error) {
      Logger.log('[apiGetPatients] ERRO ao abrir planilha: ' + error.message);
      return [];
    }
    
    var sheet = ss.getSheetByName('Patients');
    if (!sheet) {
      Logger.log('[apiGetPatients] ERRO: Aba Patients não encontrada');
      return [];
    }
    
    Logger.log('[apiGetPatients] Aba Patients encontrada');
    Logger.log('[apiGetPatients] Chamando listRecords("Patients")...');
    
    var all = listRecords('Patients');
    Logger.log('[apiGetPatients] listRecords retornou: ' + (all ? 'array com ' + all.length + ' itens' : 'null/undefined'));
    
    if (!all || !Array.isArray(all)) {
      Logger.log('[apiGetPatients] AVISO: listRecords não retornou array válido');
      return [];
    }
    
    var result = [];
    Logger.log('[apiGetPatients] Filtrando ' + all.length + ' pacientes...');
    
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      
      if (!p || !p.id) {
        Logger.log('[apiGetPatients] Registro ' + i + ' inválido (sem id)');
        continue;
      }
      
      var status = '';
      if (p.status) {
        status = String(p.status).trim().toUpperCase();
      }
      
      if (i < 3) {
        Logger.log('[apiGetPatients] Paciente ' + i + ': id=' + p.id + ', name=' + p.full_name + ', status="' + status + '"');
      }
      
      if (status === '' || status === 'ACTIVE') {
        result.push(p);
      }
    }
    
    Logger.log('[apiGetPatients] Total de pacientes ativos: ' + result.length);
    Logger.log('[apiGetPatients] ===== RETORNANDO ARRAY =====');
    
    return result;
    
  } catch (error) {
    Logger.log('[apiGetPatients] ===== ERRO CRÍTICO =====');
    Logger.log('[apiGetPatients] Mensagem: ' + error.message);
    Logger.log('[apiGetPatients] Stack: ' + error.stack);
    return [];
  }
}

/**
 * API - Retorna usuário atual
 */
function apiGetCurrentUser() {
  try {
    var user = getCurrentUser();
    Logger.log('[apiGetCurrentUser] Retornando: ' + JSON.stringify(user));
    return user;
  } catch (error) {
    Logger.log('[apiGetCurrentUser] ERRO: ' + error.message);
    return { email: '', role: null };
  }
}

/**
 * API SIMPLIFICADA PARA O FRONTEND
 */
function getFrontendPatients() {
  try {
    Logger.log('[getFrontendPatients] ===== INÍCIO =====');
    
    ensureSystemInitialized();
    
    var all = listRecords('Patients');
    
    if (!all || !Array.isArray(all)) {
      Logger.log('[getFrontendPatients] Erro: listRecords não retornou array');
      return [];
    }
    
    Logger.log('[getFrontendPatients] Total de registros: ' + all.length);
    
    var active = [];
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      if (!p || !p.id) continue;
      
      var status = p.status ? String(p.status).trim().toUpperCase() : '';
      if (status === '' || status === 'ACTIVE') {
        active.push({
          id: p.id,
          full_name: p.full_name,
          birth_date: p.birth_date,
          sex: p.sex,
          document_id: p.document_id,
          status: p.status || 'ACTIVE'
        });
      }
    }
    
    Logger.log('[getFrontendPatients] Pacientes ativos: ' + active.length);
    Logger.log('[getFrontendPatients] ===== RETORNANDO =====');
    
    return active;
    
  } catch (error) {
    Logger.log('[getFrontendPatients] ERRO: ' + error.message);
    return [];
  }
}