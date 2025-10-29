/**
 * ============================================================================
 * storage.gs - Gerenciamento de Arquivos no Drive
 * ============================================================================
 */

/**
 * Garante existência da pasta do paciente
 */
function ensurePatientFolder(patientId) {
  var storageId = PropertiesService.getScriptProperties().getProperty('STORAGE_ROOT_ID');
  var root = DriveApp.getFolderById(storageId);
  var patientsFolder = getOrCreateFolder(root, 'patients');
  return getOrCreateFolder(patientsFolder, patientId);
}

/**
 * Garante existência da pasta do atendimento
 */
function ensureEncounterFolder(patientId, encounterId) {
  var patientFolder = ensurePatientFolder(patientId);
  var encountersFolder = getOrCreateFolder(patientFolder, 'encounters');
  return getOrCreateFolder(encountersFolder, encounterId);
}

/**
 * Helper: cria ou retorna pasta
 */
function getOrCreateFolder(parent, name) {
  var iterator = parent.getFoldersByName(name);
  if (iterator.hasNext()) {
    return iterator.next();
  }
  return parent.createFolder(name);
}

/**
 * Upload de arquivo
 */
function uploadFile(patientId, encounterId, blob, filename) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var folder = encounterId ? ensureEncounterFolder(patientId, encounterId) : ensurePatientFolder(patientId);
  var file = folder.createFile(blob);
  
  if (filename) file.setName(filename);
  
  var attachment = {
    id: uuid(),
    patient_id: patientId,
    encounter_id: encounterId || '',
    filename: filename || file.getName(),
    mimetype: blob.getContentType(),
    drive_file_id: file.getId(),
    uploaded_at: nowISO()
  };
  
  appendRow('Attachments', attachment);
  logAudit('CREATE', 'Attachments', attachment.id);
  
  return attachment;
}

/**
 * Lista arquivos do paciente
 */
function listPatientFiles(patientId) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  return listRecords('Attachments', { patient_id: patientId });
}
