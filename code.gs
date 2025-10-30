/**
 * ============================================================================
 * SISTEMA DE FISIOTERAPIA - GOOGLE APPS SCRIPT
 * Code.gs - Arquivo Principal (COM LOGIN)
 * ============================================================================
 */

/**
 * Entrada GET - Serve a UI e API
 */
function doGet(e) {
  var path = (e && e.parameter && e.parameter.path) ? e.parameter.path : '/';
  var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : '';
  
  try {
    Logger.log('[doGet] ===== INÍCIO =====');
    Logger.log('[doGet] Path solicitado: ' + path);
    Logger.log('[doGet] Page solicitado: ' + page);
    
    // Garante inicialização do sistema
    ensureSystemInitialized();
    Logger.log('[doGet] Sistema inicializado');
    
    // ✅ NOVO: Verifica se está acessando a página de login
    if (path === '/login' || page === 'login') {
      Logger.log('[doGet] Servindo página de login');
      return HtmlService.createHtmlOutputFromFile('login')
        .setTitle('Login - Sistema Fisioterapia')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    
    // Verifica permissão do usuário (APENAS para páginas protegidas)
    var user = getCurrentUser();
    
    Logger.log('[doGet] User objeto: ' + JSON.stringify(user));
    Logger.log('[doGet] User.email: ' + user.email);
    Logger.log('[doGet] User.role: ' + user.role);
    
    // Validação mais robusta
    if (!user) {
      Logger.log('[doGet] BLOQUEIO: user é null - Redirecionando para login');
      return redirectToLogin('Usuário não autenticado');
    }
    
    if (!user.email) {
      Logger.log('[doGet] BLOQUEIO: email vazio - Redirecionando para login');
      return redirectToLogin('Email não detectado');
    }
    
    if (!user.role || user.role === null || user.role === 'null') {
      Logger.log('[doGet] BLOQUEIO: role inválida - Redirecionando para login');
      return redirectToLogin('Permissão insuficiente');
    }
    
    Logger.log('[doGet] ✅ ACESSO PERMITIDO - Role: ' + user.role);
    
    // Serve a interface principal
    if (path === '/' || path === '/dashboard' || page === 'dashboard') {
      var template = HtmlService.createTemplateFromFile('index');
      template.user = user;
      
      // ✅ CARREGAR PACIENTES NO SERVIDOR E PASSAR PARA O TEMPLATE
      Logger.log('[doGet] Carregando pacientes no servidor...');
      var patients = getFrontendPatients();
      Logger.log('[doGet] Pacientes carregados: ' + patients.length);
      template.patients = patients;
      template.patientsJson = JSON.stringify(patients);
      
      return template.evaluate()
        .setTitle('Sistema Fisioterapia')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    
    // API endpoints
    if (path && String(path).toLowerCase().indexOf('/api/') === 0) {
      var result = handleApiGet(e);
      return jsonResponse(result, 200);
    }
    
    return jsonResponse({ error: 'Rota não encontrada' }, 404);
    
  } catch (error) {
    Logger.log('[doGet] ERRO CRÍTICO: ' + error.message);
    Logger.log('[doGet] Stack: ' + error.stack);
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * ✅ NOVA FUNÇÃO: Redireciona para a página de login
 */
function redirectToLogin(message) {
  var html = '<html><head>' +
    '<meta http-equiv="refresh" content="0;url=?page=login">' +
    '</head><body>' +
    '<p>Redirecionando para login...</p>' +
    '<p>' + message + '</p>' +
    '</body></html>';
  
  return HtmlService.createHtmlOutput(html)
    .setTitle('Redirecionando...')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Entrada POST - API endpoints
 */
function doPost(e) {
  try {
    Logger.log('[doPost] Processando requisição POST');
    
    var body = {};
    try {
      body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    } catch (err) {
      body = {};
    }
    
    var path = (e && e.parameter && e.parameter.path) ? String(e.parameter.path).toLowerCase() : '';
    var result = handleApiPost(path, body);
    
    return jsonResponse(result, 200);
    
  } catch (error) {
    Logger.log('[doPost] Erro: ' + error.message);
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Helper para incluir arquivos HTML
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Helper para resposta JSON
 */
function jsonResponse(obj, status) {
  var output = ContentService.createTextOutput(JSON.stringify(obj || {}));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}


