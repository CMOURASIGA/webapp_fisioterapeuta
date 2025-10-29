/**
 * ============================================================================
 * auth.gs - Autenticação e Controle de Acesso
 * ============================================================================
 */

/**
 * Retorna role do usuário por email
 */
function getRoleByEmail(email) {
  try {
    Logger.log('[getRoleByEmail] Buscando role para: ' + email);
    
    var records = listRecords('ACL', { email: email, status: 'ACTIVE' });
    
    Logger.log('[getRoleByEmail] Registros encontrados: ' + records.length);
    
    if (records.length > 0) {
      Logger.log('[getRoleByEmail] Primeiro registro: ' + JSON.stringify(records[0]));
      return records[0].role;
    }
    
    Logger.log('[getRoleByEmail] Nenhum registro encontrado, retornando null');
    return null;
    
  } catch (error) {
    Logger.log('[getRoleByEmail] ERRO: ' + error.message);
    return null;
  }
}

/**
 * Middleware: exige roles específicos
 */
function requireRole(allowedRoles) {
  var email = Session.getActiveUser().getEmail();
  var role = getRoleByEmail(email);
  
  if (!role || allowedRoles.indexOf(role) === -1) {
    throw new Error('Acesso negado. Permissão insuficiente.');
  }
  
  return { email: email, role: role };
}

/**
 * Retorna informações do usuário atual
 */
function getCurrentUser() {
  try {
    var email = Session.getActiveUser().getEmail();
    
    Logger.log('[getCurrentUser] Email obtido: ' + email);
    
    if (!email) {
      Logger.log('[getCurrentUser] ERRO: Email vazio');
      return { email: '', role: null };
    }
    
    // Garante que o sistema está inicializado
    ensureSystemInitialized();
    
    var role = getRoleByEmail(email);
    
    Logger.log('[getCurrentUser] Role obtida: ' + role);
    Logger.log('[getCurrentUser] Role tipo: ' + typeof role);
    Logger.log('[getCurrentUser] Role é null?: ' + (role === null));
    
    // Se não tem role, cria como ADMIN automaticamente (primeiro acesso)
    if (!role || role === null) {
      Logger.log('[getCurrentUser] Usuário sem role, criando como ADMIN...');
      
      appendRow('ACL', {
        email: email,
        role: 'ADMIN',
        status: 'ACTIVE',
        created_at: nowISO()
      });
      
      role = 'ADMIN';
      Logger.log('[getCurrentUser] Role ADMIN atribuída ao usuário');
    }
    
    var result = { email: email, role: role };
    Logger.log('[getCurrentUser] Retornando: ' + JSON.stringify(result));
    
    return result;
    
  } catch (error) {
    Logger.log('[getCurrentUser] ERRO CRÍTICO: ' + error.message);
    Logger.log('[getCurrentUser] Stack: ' + error.stack);
    return { email: '', role: null };
  }
}