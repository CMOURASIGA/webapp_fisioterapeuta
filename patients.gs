/**
 * ============================================================================
 * patients.gs - Lógica de Gerenciamento de Pacientes
 * ATUALIZADO: Suporte completo a status em português
 * ============================================================================
 */

/**
 * Status válidos para pacientes
 */
var VALID_PATIENT_STATUS = ['ACTIVE', 'INACTIVE', 'DISCHARGED', 'TRANSFERRED', 'DECEASED'];

/**
 * Cria novo paciente
 */
function createPatient(data) {
  requireRole(['RECEP', 'FISIO', 'COORD', 'ADMIN']);
  
  var patient = {
    id: uuid(),
    full_name: data.full_name,
    birth_date: data.birth_date,
    sex: data.sex,
    document_id: data.document_id,
    neonatal_mother_id: data.neonatal_mother_id || '',
    allergies_json: JSON.stringify(data.allergies || []),
    conditions_json: JSON.stringify(data.conditions || []),
    created_at: nowISO(),
    updated_at: nowISO(),
    status: data.status || 'ACTIVE' // ✅ Status padrão é ACTIVE
  };
  
  appendRow('Patients', patient);
  logAudit('CREATE', 'Patients', patient.id);
  
  Logger.log('[createPatient] Paciente criado: ' + patient.id + ' - Status: ' + patient.status);
  
  return patient;
}

/**
 * Atualiza paciente existente
 */
function updatePatient(id, data) {
  requireRole(['RECEP', 'FISIO', 'COORD', 'ADMIN']);
  
  var updates = {
    updated_at: nowISO()
  };
  
  // ✅ Atualiza apenas campos fornecidos
  if (data.full_name !== undefined) updates.full_name = data.full_name;
  if (data.birth_date !== undefined) updates.birth_date = data.birth_date;
  if (data.sex !== undefined) updates.sex = data.sex;
  if (data.document_id !== undefined) updates.document_id = data.document_id;
  if (data.neonatal_mother_id !== undefined) updates.neonatal_mother_id = data.neonatal_mother_id;
  
  if (data.allergies !== undefined) {
    updates.allergies_json = JSON.stringify(data.allergies || []);
  }
  
  if (data.conditions !== undefined) {
    updates.conditions_json = JSON.stringify(data.conditions || []);
  }
  
  // ✅ VALIDAÇÃO DE STATUS
  if (data.status !== undefined) {
    var statusUpper = String(data.status).trim().toUpperCase();
    
    if (VALID_PATIENT_STATUS.indexOf(statusUpper) === -1) {
      Logger.log('[updatePatient] Status inválido: ' + data.status);
      throw new Error('Status inválido. Use: ' + VALID_PATIENT_STATUS.join(', '));
    }
    
    updates.status = statusUpper;
    Logger.log('[updatePatient] Atualizando status para: ' + statusUpper);
  }
  
  var success = updateRecord('Patients', id, updates);
  
  if (success) {
    logAudit('UPDATE', 'Patients', id, updates);
    Logger.log('[updatePatient] Paciente atualizado: ' + id);
  }
  
  return success;
}

/**
 * ✅ NOVA FUNÇÃO: Muda apenas o status do paciente
 */
function changePatientStatus(patientId, newStatus, notes) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  Logger.log('[changePatientStatus] Mudando status: ' + patientId + ' -> ' + newStatus);
  
  // Valida status
  var statusUpper = String(newStatus).trim().toUpperCase();
  
  if (VALID_PATIENT_STATUS.indexOf(statusUpper) === -1) {
    throw new Error('Status inválido: ' + newStatus);
  }
  
  // Busca paciente
  var patient = getById('Patients', patientId);
  
  if (!patient) {
    throw new Error('Paciente não encontrado: ' + patientId);
  }
  
  var oldStatus = patient.status || 'ACTIVE';
  
  // Atualiza status
  var success = updateRecord('Patients', patientId, {
    status: statusUpper,
    updated_at: nowISO()
  });
  
  if (success) {
    // Registra mudança no log de auditoria
    logAudit('STATUS_CHANGE', 'Patients', patientId, {
      old_status: oldStatus,
      new_status: statusUpper,
      notes: notes || ''
    });
    
    Logger.log('[changePatientStatus] Status alterado: ' + oldStatus + ' -> ' + statusUpper);
    
    // Se houver observações, registra no histórico
    if (notes) {
      try {
        addPatientStatusNote(patientId, oldStatus, statusUpper, notes);
      } catch (e) {
        Logger.log('[changePatientStatus] Erro ao adicionar nota: ' + e.message);
      }
    }
  }
  
  return success;
}

/**
 * ✅ NOVA FUNÇÃO: Adiciona nota de mudança de status
 */
function addPatientStatusNote(patientId, oldStatus, newStatus, notes) {
  var statusNote = {
    id: uuid(),
    patient_id: patientId,
    recorded_at: nowISO(),
    type: 'STATUS_CHANGE',
    old_status: oldStatus,
    new_status: newStatus,
    notes: notes
  };
  
  // Tenta adicionar na tabela StatusHistory (se existir)
  try {
    appendRow('StatusHistory', statusNote);
    Logger.log('[addPatientStatusNote] Nota de status registrada');
  } catch (e) {
    Logger.log('[addPatientStatusNote] Tabela StatusHistory não existe: ' + e.message);
  }
}

/**
 * ✅ NOVA FUNÇÃO: Lista pacientes por status
 */
function getPatientsByStatus(status) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var statusUpper = String(status).trim().toUpperCase();
  
  if (VALID_PATIENT_STATUS.indexOf(statusUpper) === -1) {
    throw new Error('Status inválido: ' + status);
  }
  
  return listRecords('Patients', { status: statusUpper });
}

/**
 * ✅ NOVA FUNÇÃO: Conta pacientes por status
 */
function countPatientsByStatus() {
  requireRole(['COORD', 'ADMIN']);
  
  var allPatients = listRecords('Patients');
  var counts = {};
  
  VALID_PATIENT_STATUS.forEach(function(status) {
    counts[status] = 0;
  });
  
  allPatients.forEach(function(p) {
    var status = (p.status || 'ACTIVE').toUpperCase();
    if (counts[status] !== undefined) {
      counts[status]++;
    }
  });
  
  return counts;
}

/**
 * Adiciona contato de emergência
 */
function addContact(patientId, data) {
  requireRole(['RECEP', 'FISIO', 'COORD', 'ADMIN']);
  
  var contact = {
    id: uuid(),
    patient_id: patientId,
    name: data.name,
    relation: data.relation,
    phone: data.phone,
    email: data.email || ''
  };
  
  appendRow('Contacts', contact);
  logAudit('CREATE', 'Contacts', contact.id);
  
  return contact;
}