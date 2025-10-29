/**
 * ============================================================================
 * encounters.gs - Gerenciamento de Atendimentos
 * VERSÃO ATUALIZADA - Profissional selecionado manualmente
 * ============================================================================
 */

/**
 * Abre novo atendimento
 * CORRIGIDO: Recebe professional_id do formulário
 */
function openEncounter(data) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  Logger.log('[openEncounter] Data recebida: ' + JSON.stringify(data));
  
  // Valida professional_id
  if (!data.professional_id) {
    throw new Error('Profissional não selecionado');
  }
  
  // Verifica se o profissional existe
  var professional = getById('Professionals', data.professional_id);
  
  if (!professional) {
    throw new Error('Profissional não encontrado: ' + data.professional_id);
  }
  
  Logger.log('[openEncounter] Profissional: ' + professional.full_name);
  
  var encounter = {
    id: uuid(),
    patient_id: data.patient_id,
    professional_id: data.professional_id,
    started_at: nowISO(),
    ended_at: '',
    location: data.location,
    type: data.type,
    notes: ''
  };
  
  appendRow('Encounters', encounter);
  logAudit('CREATE', 'Encounters', encounter.id);
  
  Logger.log('[openEncounter] Atendimento criado: ' + encounter.id);
  
  return encounter;
}

/**
 * Fecha atendimento
 */
function closeEncounter(encounterId) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var success = updateRecord('Encounters', encounterId, { ended_at: nowISO() });
  if (success) logAudit('UPDATE', 'Encounters', encounterId);
  
  return success;
}

/**
 * Adiciona nota SOAP
 */
function addSessionNote(data) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var note = {
    id: uuid(),
    encounter_id: data.encounter_id,
    recorded_at: nowISO(),
    subjective: data.subjective || '',
    objective: data.objective || '',
    assessment: data.assessment || '',
    plan: data.plan || ''
  };
  
  appendRow('SessionNotes', note);
  logAudit('CREATE', 'SessionNotes', note.id);
  
  return note;
}

/**
 * Registra sinais vitais
 */
function recordVitals(data) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var vitals = {
    id: uuid(),
    encounter_id: data.encounter_id,
    recorded_at: nowISO(),
    spo2: data.spo2 || '',
    hr: data.hr || '',
    rr: data.rr || '',
    bp_sys: data.bp_sys || '',
    bp_dia: data.bp_dia || '',
    temp: data.temp || ''
  };
  
  appendRow('Vitals', vitals);
  logAudit('CREATE', 'Vitals', vitals.id);
  
  return vitals;
}
/**
 * Lista atendimentos de um paciente
 */
function getPatientEncounters(patientId) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var encounters = listRecords('Encounters', { patient_id: patientId });
  
  // Enriquece com dados do profissional
  var enriched = encounters.map(function(enc) {
    var professional = getById('Professionals', enc.professional_id);
    var notes = listRecords('SessionNotes', { encounter_id: enc.id });
    var vitals = listRecords('Vitals', { encounter_id: enc.id });
    var assessments = listRecords('Assessments', { encounter_id: enc.id });
    
    return {
      id: enc.id,
      patient_id: enc.patient_id,
      professional_name: professional ? professional.full_name : 'N/A',
      professional_crefito: professional ? professional.crefito : '',
      started_at: enc.started_at,
      ended_at: enc.ended_at,
      location: enc.location,
      type: enc.type,
      notes: notes,
      vitals: vitals,
      assessments: assessments,
      status: enc.ended_at ? 'CLOSED' : 'OPEN'
    };
  });
  
  // Ordena do mais recente para o mais antigo
  enriched.sort(function(a, b) {
    return new Date(b.started_at) - new Date(a.started_at);
  });
  
  return enriched;
}

/**
 * Obtém detalhes completos de um atendimento
 */
/**
 * Obtém detalhes completos de um atendimento
 * VERSÃO ULTRA-CORRIGIDA - Com validação robusta
 */
function getEncounterDetails(encounterId) {
  Logger.log('[getEncounterDetails] ===== INÍCIO =====');
  Logger.log('[getEncounterDetails] Encounter ID recebido: ' + encounterId);
  Logger.log('[getEncounterDetails] Tipo: ' + typeof encounterId);
  
  // ✅ VALIDAÇÃO 1: ID não pode ser vazio
  if (!encounterId || encounterId === '' || encounterId === null || encounterId === undefined) {
    Logger.log('[getEncounterDetails] ❌ ERRO: encounterId vazio, null ou undefined');
    throw new Error('ID do atendimento não fornecido');
  }
  
  // ✅ VALIDAÇÃO 2: Verificar permissão
  try {
    requireRole(['FISIO', 'COORD', 'ADMIN']);
    Logger.log('[getEncounterDetails] ✅ Permissão validada');
  } catch (error) {
    Logger.log('[getEncounterDetails] ❌ ERRO de permissão: ' + error.message);
    throw error;
  }
  
  try {
    // ✅ PASSO 1: Buscar atendimento
    Logger.log('[getEncounterDetails] [1/7] Buscando atendimento...');
    var encounter = getById('Encounters', encounterId);
    
    if (!encounter) {
      Logger.log('[getEncounterDetails] ❌ ERRO: Atendimento não encontrado no banco');
      Logger.log('[getEncounterDetails] - ID buscado: ' + encounterId);
      
      // ✅ DIAGNÓSTICO: Listar todos os IDs da tabela
      try {
        var allEncounters = listRecords('Encounters');
        Logger.log('[getEncounterDetails] 📊 DIAGNÓSTICO: Total de atendimentos na tabela: ' + allEncounters.length);
        
        if (allEncounters.length > 0) {
          Logger.log('[getEncounterDetails] IDs disponíveis:');
          for (var i = 0; i < Math.min(5, allEncounters.length); i++) {
            Logger.log('[getEncounterDetails] - [' + i + '] ' + allEncounters[i].id);
          }
          
          // Verifica se o ID está na lista
          var found = false;
          for (var j = 0; j < allEncounters.length; j++) {
            if (allEncounters[j].id === encounterId) {
              found = true;
              Logger.log('[getEncounterDetails] ✅ ID ENCONTRADO na lista (índice ' + j + ')');
              encounter = allEncounters[j];
              break;
            }
          }
          
          if (!found) {
            Logger.log('[getEncounterDetails] ❌ ID NÃO ENCONTRADO na lista');
          }
        }
      } catch (diagError) {
        Logger.log('[getEncounterDetails] ⚠️ Erro no diagnóstico: ' + diagError.message);
      }
      
      if (!encounter) {
        throw new Error('Atendimento não encontrado: ' + encounterId);
      }
    }
    
    Logger.log('[getEncounterDetails] ✅ [1/7] Atendimento encontrado');
    Logger.log('[getEncounterDetails] - ID: ' + encounter.id);
    Logger.log('[getEncounterDetails] - Patient ID: ' + encounter.patient_id);
    Logger.log('[getEncounterDetails] - Professional ID: ' + encounter.professional_id);
    Logger.log('[getEncounterDetails] - Started: ' + encounter.started_at);
    Logger.log('[getEncounterDetails] - Ended: ' + encounter.ended_at);
    Logger.log('[getEncounterDetails] - Location: ' + encounter.location);
    Logger.log('[getEncounterDetails] - Type: ' + encounter.type);
    
    // ✅ PASSO 2: Buscar paciente
    Logger.log('[getEncounterDetails] [2/7] Buscando paciente...');
    var patient = null;
    
    if (encounter.patient_id) {
      try {
        patient = getById('Patients', encounter.patient_id);
        Logger.log('[getEncounterDetails] ✅ [2/7] Paciente: ' + (patient ? patient.full_name : 'NÃO ENCONTRADO'));
      } catch (patError) {
        Logger.log('[getEncounterDetails] ⚠️ Erro ao buscar paciente: ' + patError.message);
      }
    } else {
      Logger.log('[getEncounterDetails] ⚠️ patient_id ausente no encounter');
    }
    
    // Fallback para paciente
    if (!patient) {
      patient = { full_name: 'Paciente não encontrado', id: encounter.patient_id || 'N/A' };
    }
    
    // ✅ PASSO 3: Buscar profissional
    Logger.log('[getEncounterDetails] [3/7] Buscando profissional...');
    var professional = null;
    
    if (encounter.professional_id) {
      try {
        professional = getById('Professionals', encounter.professional_id);
        Logger.log('[getEncounterDetails] ✅ [3/7] Profissional: ' + (professional ? professional.full_name : 'NÃO ENCONTRADO'));
      } catch (profError) {
        Logger.log('[getEncounterDetails] ⚠️ Erro ao buscar profissional: ' + profError.message);
      }
    } else {
      Logger.log('[getEncounterDetails] ⚠️ professional_id ausente no encounter');
    }
    
    // Fallback para profissional
    if (!professional) {
      professional = { 
        full_name: 'Profissional não encontrado', 
        crefito: '', 
        id: encounter.professional_id || 'N/A' 
      };
    }
    
    // ✅ PASSO 4: Buscar notas SOAP
    Logger.log('[getEncounterDetails] [4/7] Buscando notas SOAP...');
    var notes = [];
    try {
      notes = listRecords('SessionNotes', { encounter_id: encounterId });
      Logger.log('[getEncounterDetails] ✅ [4/7] Notas encontradas: ' + notes.length);
    } catch (notesError) {
      Logger.log('[getEncounterDetails] ⚠️ Erro ao buscar notas: ' + notesError.message);
    }
    
    // ✅ PASSO 5: Buscar sinais vitais
    Logger.log('[getEncounterDetails] [5/7] Buscando sinais vitais...');
    var vitals = [];
    try {
      vitals = listRecords('Vitals', { encounter_id: encounterId });
      Logger.log('[getEncounterDetails] ✅ [5/7] Sinais vitais encontrados: ' + vitals.length);
    } catch (vitalsError) {
      Logger.log('[getEncounterDetails] ⚠️ Erro ao buscar vitais: ' + vitalsError.message);
    }
    
    // ✅ PASSO 6: Buscar avaliações
    Logger.log('[getEncounterDetails] [6/7] Buscando avaliações...');
    var assessments = [];
    try {
      assessments = listRecords('Assessments', { encounter_id: encounterId });
      Logger.log('[getEncounterDetails] ✅ [6/7] Avaliações encontradas: ' + assessments.length);
    } catch (assessError) {
      Logger.log('[getEncounterDetails] ⚠️ Erro ao buscar avaliações: ' + assessError.message);
    }
    
    // ✅ PASSO 7: Buscar procedimentos
    Logger.log('[getEncounterDetails] [7/7] Buscando procedimentos...');
    var procedures = [];
    try {
      procedures = listRecords('Procedures', { encounter_id: encounterId });
      Logger.log('[getEncounterDetails] ✅ [7/7] Procedimentos encontrados: ' + procedures.length);
    } catch (procError) {
      Logger.log('[getEncounterDetails] ⚠️ Erro ao buscar procedimentos: ' + procError.message);
    }
    
    // ✅ MONTAGEM DO RESULTADO
    Logger.log('[getEncounterDetails] Montando resultado final...');
    
    var result = {
      encounter: encounter,
      patient: patient,
      professional: professional,
      notes: notes,
      vitals: vitals,
      assessments: assessments,
      procedures: procedures
    };
    
    // ✅ LOG FINAL DETALHADO
    Logger.log('[getEncounterDetails] ===== RESULTADO =====');
    Logger.log('[getEncounterDetails] ✅ Encounter: ' + (result.encounter ? 'OK' : 'NULL'));
    Logger.log('[getEncounterDetails] ✅ Patient: ' + (result.patient ? result.patient.full_name : 'NULL'));
    Logger.log('[getEncounterDetails] ✅ Professional: ' + (result.professional ? result.professional.full_name : 'NULL'));
    Logger.log('[getEncounterDetails] ✅ Notes: ' + result.notes.length);
    Logger.log('[getEncounterDetails] ✅ Vitals: ' + result.vitals.length);
    Logger.log('[getEncounterDetails] ✅ Assessments: ' + result.assessments.length);
    Logger.log('[getEncounterDetails] ✅ Procedures: ' + result.procedures.length);
    Logger.log('[getEncounterDetails] ===== FIM =====');
    
    return result;
    
  } catch (error) {
    Logger.log('[getEncounterDetails] ❌ ERRO CRÍTICO:');
    Logger.log('[getEncounterDetails] - Message: ' + error.message);
    Logger.log('[getEncounterDetails] - Stack: ' + error.stack);
    Logger.log('[getEncounterDetails] ===== ERRO =====');
    throw error;
  }
}

/**
 * Deleta atendimento (soft delete)
 */
function deleteEncounter(encounterId) {
  requireRole(['COORD', 'ADMIN']);
  
  var encounter = getById('Encounters', encounterId);
  if (!encounter) {
    throw new Error('Atendimento não encontrado');
  }
  
  // Marca como deletado
  var success = updateRecord('Encounters', encounterId, { 
    status: 'DELETED',
    updated_at: nowISO()
  });
  
  if (success) {
    logAudit('DELETE', 'Encounters', encounterId);
  }
  
  return success;
}

/**
 * Atualiza dados do atendimento
 */
function updateEncounter(encounterId, data) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var updates = {
    location: data.location,
    type: data.type,
    notes: data.notes || '',
    updated_at: nowISO()
  };
  
  var success = updateRecord('Encounters', encounterId, updates);
  
  if (success) {
    logAudit('UPDATE', 'Encounters', encounterId);
  }
  
  return success;
}