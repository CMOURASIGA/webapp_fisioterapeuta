/**
 * ============================================================================
 * middleware.gs - Auditoria e LGPD
 * ============================================================================
 */

/**
 * Log de auditoria
 */
function logAudit(action, entity, entityId, payload) {
  if (payload === undefined) payload = {};
  
  var user = getCurrentUser();
  var payloadStr = JSON.stringify(payload);
  var hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payloadStr);
  var hash = hashBytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  
  var log = {
    when: nowISO(),
    who: user.email,
    action: action,
    entity: entity,
    id: entityId,
    payload_hash: hash
  };
  
  appendRow('AuditLog', log);
}

/**
 * Validação de LGPD: verifica consentimento
 */
function hasConsent(patientId, scope) {
  var consents = listRecords('Consents', { patient_id: patientId, scope: scope });
  return consents.some(function(c) {
    return c.granted_at && !c.revoked_at;
  });
}

