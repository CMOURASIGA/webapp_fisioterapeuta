/**
 * ============================================================================
 * utils.gs - Funções Utilitárias
 * ============================================================================
 */

/**
 * Gera UUID v4
 */
function uuid() {
  return Utilities.getUuid();
}

/**
 * Retorna timestamp ISO
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * Parse seguro de JSON
 */
function safeJsonParse(str, fallback) {
  if (fallback === undefined) fallback = {};
  try {
    return JSON.parse(str || '{}');
  } catch (e) {
    return fallback;
  }
}

/**
 * Formata data BR
 */
function formatDateBR(date) {
  return Utilities.formatDate(new Date(date), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
}
