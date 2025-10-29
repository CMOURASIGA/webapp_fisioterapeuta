/**
 * ============================================================================
 * assessments.gs - Gerenciamento de Avaliações
 * ============================================================================
 */

/**
 * Lista templates de avaliação
 */
function getAssessmentTemplate(tool) {
  return listRecords('AssessmentTemplates', tool ? { tool: tool } : {});
}

/**
 * Valida dados de avaliação
 */
function validateAssessment(tool, data) {
  var template = getAssessmentTemplate(tool);
  var errors = [];
  
  template.forEach(function(field) {
    var value = data[field.field_key];
    
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push('Campo "' + field.label + '" é obrigatório');
    }
    
    if (field.type === 'number' && value !== undefined && value !== null && value !== '') {
      var num = Number(value);
      if (field.min !== '' && field.min !== null && field.min !== undefined && num < Number(field.min)) {
        errors.push('"' + field.label + '" deve ser >= ' + field.min);
      }
      if (field.max !== '' && field.max !== null && field.max !== undefined && num > Number(field.max)) {
        errors.push('"' + field.label + '" deve ser <= ' + field.max);
      }
    }
  });
  
  return errors;
}

/**
 * Calcula score da avaliação
 */
function calculateScore(tool, data) {
  switch(tool) {
    case 'Silverman':
    case 'Downes':
      return Object.keys(data).reduce(function(sum, k) {
        var v = parseInt(data[k], 10);
        return sum + (isNaN(v) ? 0 : v);
      }, 0);
    
    case 'EVA':
      return parseInt(data.eva_score, 10) || 0;
    
    case 'Borg':
      return parseInt(data.borg_score, 10) || 0;
    
    default:
      return 0;
  }
}

/**
 * Registra avaliação
 */
function recordAssessment(data) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var errors = validateAssessment(data.tool, data.data || {});
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
  
  var assessment = {
    id: uuid(),
    encounter_id: data.encounter_id,
    tool: data.tool,
    data_json: JSON.stringify(data.data || {}),
    score: calculateScore(data.tool, data.data || {}),
    recorded_at: nowISO()
  };
  
  appendRow('Assessments', assessment);
  logAudit('CREATE', 'Assessments', assessment.id);
  
  return assessment;
}