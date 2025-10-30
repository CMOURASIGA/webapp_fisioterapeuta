/**
 * ============================================================================
 * sheets.gs - Operações de Leitura/Escrita na Planilha
 * ============================================================================
 */

// Cache da planilha
var __SS_CACHE = null;

/**
 * Obtém a planilha principal
 */
function getSS() {
  if (__SS_CACHE) return __SS_CACHE;
  
  var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
  if (!id) {
    Logger.log('[getSS] DB_ID não configurado');
    return null;
  }
  
  try {
    __SS_CACHE = SpreadsheetApp.openById(id);
    Logger.log('[getSS] Planilha aberta: ' + __SS_CACHE.getName());
    return __SS_CACHE;
  } catch (error) {
    Logger.log('[getSS] ERRO ao abrir planilha: ' + error.message);
    return null;
  }
}

/**
 * Define o ID do banco de dados
 */
function setDatabaseId(id) {
  PropertiesService.getScriptProperties().setProperty('DB_ID', id);
  __SS_CACHE = SpreadsheetApp.openById(id);
}

/**
 * Obtém uma aba específica
 */
function getSheet(name) {
  var SS = getSS();
  if (!SS) {
    throw new Error('DB_ID não configurado. Execute setupInitial()');
  }
  
  var sheet = SS.getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet "' + name + '" não encontrada');
  }
  
  return sheet;
}

/**
 * Adiciona uma nova linha
 */
function appendRow(sheetName, obj) {
  try {
    var sh = getSheet(sheetName);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = headers.map(function(h) {
      return obj.hasOwnProperty(h) ? obj[h] : '';
    });
    sh.appendRow(row);
    Logger.log('[appendRow] Linha adicionada em ' + sheetName + ': ' + obj.id);
    return obj;
  } catch (error) {
    Logger.log('[appendRow] ERRO: ' + error.message);
    throw error;
  }
}

/**
 * Busca registro por ID
 */
function getById(sheetName, id) {
  try {
    var sh = getSheet(sheetName);
    var data = sh.getDataRange().getValues();
    
    if (data.length < 2) {
      Logger.log('[getById] Nenhum registro em ' + sheetName);
      return null;
    }
    
    var headers = data[0];
    var idIndex = headers.indexOf('id');
    
    if (idIndex === -1) {
      Logger.log('[getById] Coluna id não encontrada em ' + sheetName);
      return null;
    }
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] === id) {
        var obj = {};
        headers.forEach(function(h, j) {
          obj[h] = data[i][j];
        });
        Logger.log('[getById] Registro encontrado em ' + sheetName + ': ' + id);
        return obj;
      }
    }
    
    Logger.log('[getById] Registro não encontrado em ' + sheetName + ': ' + id);
    return null;
    
  } catch (error) {
    Logger.log('[getById] ERRO: ' + error.message);
    return null;
  }
}

/**
 * Lista registros com filtro opcional
 * VERSÃO CORRIGIDA - Garante sempre retornar array
 */
function listRecords(sheetName, filter) {
  if (filter === undefined) filter = {};
  
  try {
    Logger.log('[listRecords] Iniciando busca em ' + sheetName);
    
    var sh = getSheet(sheetName);
    if (!sh) {
      Logger.log('[listRecords] Aba não encontrada: ' + sheetName);
      return []; // Retorna array vazio, não null
    }
    
    var data = sh.getDataRange().getValues();
    Logger.log('[listRecords] Linhas obtidas: ' + data.length);
    
    if (data.length < 2) {
      Logger.log('[listRecords] Apenas cabeçalho encontrado em ' + sheetName);
      return []; // Retorna array vazio, não null
    }
    
    var headers = data[0];
    Logger.log('[listRecords] Cabeçalhos: ' + headers.join(', '));
    
    var records = [];
    
    for (var i = 1; i < data.length; i++) {
      var obj = {};
      var isEmpty = true;
      
      headers.forEach(function(h, j) {
        obj[h] = data[i][j];
        if (data[i][j] !== '' && data[i][j] !== null && data[i][j] !== undefined) {
          isEmpty = false;
        }
      });
      
      // Ignora linhas completamente vazias
      if (isEmpty) {
        continue;
      }
      
      // Aplica filtros
      var match = true;
      for (var key in filter) {
        if (filter.hasOwnProperty(key)) {
          if (obj[key] !== filter[key]) {
            match = false;
            break;
          }
        }
      }
      
      if (match) {
        records.push(obj);
      }
    }
    
    Logger.log('[listRecords] Registros encontrados: ' + records.length);
    
    // CRÍTICO: Garantir que SEMPRE retorna um array
    return records;
    
  } catch (error) {
    Logger.log('[listRecords] ERRO: ' + error.message);
    Logger.log('[listRecords] Stack: ' + error.stack);
    
    // CRÍTICO: Retornar array vazio em caso de erro, NUNCA null
    return [];
  }
}

/**
 * Atualiza registro existente
 */
function updateRecord(sheetName, id, updates) {
  try {
    var sh = getSheet(sheetName);
    var data = sh.getDataRange().getValues();
    
    if (data.length < 2) {
      Logger.log('[updateRecord] Nenhum registro em ' + sheetName);
      return false;
    }
    
    var headers = data[0];
    var idIndex = headers.indexOf('id');
    
    if (idIndex === -1) {
      Logger.log('[updateRecord] Coluna id não encontrada em ' + sheetName);
      return false;
    }
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] === id) {
        headers.forEach(function(h, j) {
          if (updates.hasOwnProperty(h)) {
            sh.getRange(i + 1, j + 1).setValue(updates[h]);
          }
        });
        
        var updatedAtIndex = headers.indexOf('updated_at');
        if (updatedAtIndex >= 0) {
          sh.getRange(i + 1, updatedAtIndex + 1).setValue(nowISO());
        }
        
        Logger.log('[updateRecord] Registro atualizado em ' + sheetName + ': ' + id);
        return true;
      }
    }
    
    Logger.log('[updateRecord] Registro não encontrado em ' + sheetName + ': ' + id);
    return false;
    
  } catch (error) {
    Logger.log('[updateRecord] ERRO: ' + error.message);
    return false;
  }
}

/**
 * Soft delete (marca como INACTIVE)
 */
function softDelete(sheetName, id) {
  return updateRecord(sheetName, id, { status: 'INACTIVE' });
}
