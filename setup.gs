/**
 * ============================================================================
 * setup.gs - Configuração e Inicialização do Sistema
 * ============================================================================
 */

/**
 * Inicialização automática (lazy loading)
 * Cria estrutura se não existir
 */
function ensureSystemInitialized() {
  var props = PropertiesService.getScriptProperties();
  var dbId = props.getProperty('DB_ID');
  
  if (!dbId) {
    Logger.log('[ensureSystemInitialized] Criando banco de dados...');
    
    // Cria planilha principal
    var ss = SpreadsheetApp.create('FISIO_DB_Principal');
    setDatabaseId(ss.getId());
    createAllSheetsFor(ss);
    seedInitialData();
    
    Logger.log('[ensureSystemInitialized] DB_ID configurado: ' + ss.getId());
  }
  
  var storageId = props.getProperty('STORAGE_ROOT_ID');
  if (!storageId) {
    Logger.log('[ensureSystemInitialized] Criando pasta de arquivos...');
    
    var rootFolder = DriveApp.createFolder('Workspace-Fisio-Storage-' + Date.now());
    rootFolder.createFolder('patients');
    rootFolder.createFolder('05-Exports');
    props.setProperty('STORAGE_ROOT_ID', rootFolder.getId());
    
    Logger.log('[ensureSystemInitialized] Storage configurado: ' + rootFolder.getId());
  }
}

/**
 * Cria todas as abas necessárias
 */
function createAllSheetsFor(ss) {
  var sheets = [
    'Patients', 'Contacts', 'Professionals', 'Encounters', 'SessionNotes',
    'Vitals', 'Assessments', 'Procedures', 'Goals', 'CarePlans',
    'Attachments', 'Consents', 'ACL', 'AuditLog', 'AssessmentTemplates'
  ];
  
  sheets.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      setupSheetHeaders(sheet, sheetName);
    }
  });
}

/**
 * Configura cabeçalhos de cada aba
 */
function setupSheetHeaders(sheet, sheetName) {
  var headers = {
    'Patients': ['id','full_name','birth_date','sex','document_id','neonatal_mother_id','allergies_json','conditions_json','created_at','updated_at','status'],
    'Contacts': ['id','patient_id','name','relation','phone','email'],
    'Professionals': ['id','full_name','crefito','role','email','status'],
    'Encounters': ['id','patient_id','professional_id','started_at','ended_at','location','type','notes'],
    'SessionNotes': ['id','encounter_id','recorded_at','subjective','objective','assessment','plan'],
    'Vitals': ['id','encounter_id','recorded_at','spo2','hr','rr','bp_sys','bp_dia','temp'],
    'Assessments': ['id','encounter_id','tool','data_json','score','recorded_at'],
    'Procedures': ['id','encounter_id','code','description','devices_json','recorded_at'],
    'Goals': ['id','patient_id','description','criteria','due_date','status'],
    'CarePlans': ['id','patient_id','summary','frequency','duration','status'],
    'Attachments': ['id','patient_id','encounter_id','filename','mimetype','drive_file_id','uploaded_at'],
    'Consents': ['id','patient_id','scope','basis','granted_at','revoked_at','doc_file_id'],
    'ACL': ['email','role','status','created_at'],
    'AuditLog': ['when','who','action','entity','id','payload_hash'],
    'AssessmentTemplates': ['tool','version','field_key','label','type','options_json','min','max','required']
  };
  
  if (headers[sheetName]) {
    sheet.getRange(1, 1, 1, headers[sheetName].length).setValues([headers[sheetName]]);
    sheet.getRange(1, 1, 1, headers[sheetName].length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

/**
 * Insere dados iniciais
 */
function seedInitialData() {
  try {
    var email = Session.getActiveUser().getEmail();
    
    Logger.log('[seedInitialData] Email do usuário: ' + email);
    
    if (!email) {
      Logger.log('[seedInitialData] ERRO: Email vazio');
      return;
    }
    
    // Verifica se já existe
    var existing = listRecords('ACL', { email: email });
    
    if (existing.length > 0) {
      Logger.log('[seedInitialData] Usuário já existe na ACL');
      return;
    }
    
    // Adiciona usuário atual como ADMIN
    var aclEntry = {
      email: email,
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: nowISO()
    };
    
    appendRow('ACL', aclEntry);
    
    Logger.log('[seedInitialData] ✅ Usuário ADMIN criado: ' + email);
    
  } catch (error) {
    Logger.log('[seedInitialData] ERRO: ' + error.message);
  }
}
/**
 * Cadastra profissional manualmente
 * Execute esta função pelo Apps Script Editor
 */
function registerProfessional(email, fullName, crefito) {
  try {
    // Verifica se já existe
    var existing = listRecords('Professionals', { email: email });
    
    if (existing.length > 0) {
      Logger.log('Profissional já cadastrado: ' + email);
      return existing[0];
    }
    
    // Busca role na ACL
    var aclRecords = listRecords('ACL', { email: email });
    var role = aclRecords.length > 0 ? aclRecords[0].role : 'FISIO';
    
    var professional = {
      id: uuid(),
      full_name: fullName,
      crefito: crefito || '',
      role: role,
      email: email,
      status: 'ACTIVE'
    };
    
    appendRow('Professionals', professional);
    
    Logger.log('✅ Profissional cadastrado: ' + email);
    return professional;
    
  } catch (error) {
    Logger.log('❌ Erro ao cadastrar profissional: ' + error.message);
    throw error;
  }
}

/**
 * Cadastra o usuário atual como profissional
 */
function registerCurrentUserAsProfessional() {
  var email = Session.getActiveUser().getEmail();
  var name = email.split('@')[0].replace(/[._]/g, ' ').toUpperCase();
  
  return registerProfessional(email, name, '');
}