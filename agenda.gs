/**
 * ============================================================================
 * agenda.gs - Sistema de Agenda com Google Calendar
 * ============================================================================
 */

/**
 * Garante que a aba Agenda existe
 */
function ensureAgendaSheet() {
  try {
    getSheet('Agenda');
  } catch (e) {
    var ss = getSS();
    if (ss) {
      var sh = ss.insertSheet('Agenda');
      setupSheetHeaders(sh, 'Agenda');
    }
  }
}

/**
 * Lista agendamentos (com filtro de período e profissional)
 */
function getAgenda(params) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  ensureAgendaSheet();
  
  var start = params && params.start ? new Date(params.start) : null;
  var end = params && params.end ? new Date(params.end) : null;
  var professionalId = params && params.professional_id ? params.professional_id : '';
  
  var events = listRecords('Agenda', {});
  if (!Array.isArray(events)) {
    events = [];
  }
  
  // Aplica filtros
  var filtered = events.filter(function(ev) {
    try {
      // Filtro de período
      if (start && new Date(ev.end) < start) return false;
      if (end && new Date(ev.start) > end) return false;
      
      // Filtro de profissional
      if (professionalId && ev.professional_id !== professionalId) return false;
      
      return true;
    } catch (e) {
      return false;
    }
  });
  
  // Enriquece com dados do paciente
  var enriched = filtered.map(function(ev) {
    try {
      var patient = getById('Patients', ev.patient_id);
      return {
        id: ev.id,
        patient_id: ev.patient_id,
        patient_name: patient ? patient.full_name : 'Paciente desconhecido',
        professional_id: ev.professional_id,
        title: ev.title,
        start: ev.start,
        end: ev.end,
        calendar_event_id: ev.calendar_event_id
      };
    } catch (e) {
      return ev;
    }
  });
  
  return { success: true, data: enriched };
}

/**
 * Cria novo agendamento
 */
function createAgendaEntry(body) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  ensureAgendaSheet();
  
  if (!body || !body.patient_id || !body.start || !body.end) {
    throw new Error('Parâmetros obrigatórios: patient_id, start, end');
  }
  
  var currentUser = getCurrentUser();
  var professional = listRecords('Professionals', { email: currentUser.email })[0];
  
  var entry = {
    id: uuid(),
    patient_id: body.patient_id,
    professional_id: professional ? professional.id : '',
    title: body.title || 'Sessão de fisioterapia',
    start: body.start,
    end: body.end,
    created_by: currentUser.email,
    created_at: nowISO(),
    calendar_event_id: ''
  };
  
  // Tenta criar evento no Google Calendar (tolerante a falhas)
  try {
    var cal = CalendarApp.getDefaultCalendar();
    var patient = getById('Patients', entry.patient_id) || {};
    
    var calEvent = cal.createEvent(
      entry.title,
      parseLocalISO(entry.start),
      parseLocalISO(entry.end),
      {
        description: 'Paciente: ' + (patient.full_name || entry.patient_id)
      }
    );
    
    entry.calendar_event_id = calEvent.getId();
    
    Logger.log('[createAgendaEntry] Evento criado no Calendar: ' + entry.calendar_event_id);
  } catch (error) {
    Logger.log('[createAgendaEntry] Falha ao criar evento no Calendar: ' + error.message);
    // Continua mesmo se falhar no Calendar
  }
  
  // Salva na planilha
  appendRow('Agenda', entry);
  logAudit('CREATE', 'Agenda', entry.id, { patient_id: entry.patient_id });
  
  return { success: true, data: entry };
}

/**
 * Atualiza agendamento existente
 */
function updateAgendaEntry(id, body) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var existing = getById('Agenda', id);
  if (!existing) {
    throw new Error('Agendamento não encontrado');
  }
  
  var updates = {
    title: body.title || existing.title,
    start: body.start || existing.start,
    end: body.end || existing.end
  };
  
  // Atualiza no Google Calendar se tiver ID
  if (existing.calendar_event_id) {
    try {
      var cal = CalendarApp.getDefaultCalendar();
      var event = cal.getEventById(existing.calendar_event_id);
      
      if (event) {
        event.setTitle(updates.title);
        event.setTime(parseLocalISO(updates.start), parseLocalISO(updates.end));
      }
    } catch (error) {
      Logger.log('[updateAgendaEntry] Falha ao atualizar Calendar: ' + error.message);
    }
  }
  
  var success = updateRecord('Agenda', id, updates);
  
  if (success) {
    logAudit('UPDATE', 'Agenda', id, updates);
  }
  
  return { success: success };
}

/**
 * Deleta agendamento
 */
function deleteAgendaEntry(id) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  
  var existing = getById('Agenda', id);
  if (!existing) {
    return { success: false, error: 'Agendamento não encontrado' };
  }
  
  // Remove do Google Calendar se tiver ID
  if (existing.calendar_event_id) {
    try {
      var cal = CalendarApp.getDefaultCalendar();
      var event = cal.getEventById(existing.calendar_event_id);
      
      if (event) {
        event.deleteEvent();
      }
    } catch (error) {
      Logger.log('[deleteAgendaEntry] Falha ao deletar do Calendar: ' + error.message);
    }
  }
  
  var success = softDelete('Agenda', id);
  
  if (success) {
    logAudit('DELETE', 'Agenda', id);
  }
  
  return { success: success };
}

/**
 * Parse de data/hora ISO local
 */
function parseLocalISO(iso) {
  try {
    if (!iso) return null;
    
    // Tenta parsear formato YYYY-MM-DDTHH:MM
    var match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    
    if (match) {
      return new Date(
        Number(match[1]),      // year
        Number(match[2]) - 1,  // month (0-indexed)
        Number(match[3]),      // day
        Number(match[4]),      // hour
        Number(match[5]),      // minute
        0,                     // second
        0                      // millisecond
      );
    }
    
    // Fallback para Date parser nativo
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
    
  } catch (e) {
    Logger.log('[parseLocalISO] Erro ao parsear data: ' + e.message);
    return null;
  }
}

/**
 * Busca conflitos de agenda para um profissional
 */
function checkAgendaConflicts(professionalId, start, end, excludeId) {
  var events = listRecords('Agenda', { professional_id: professionalId });
  
  var startDate = new Date(start);
  var endDate = new Date(end);
  
  return events.filter(function(ev) {
    if (excludeId && ev.id === excludeId) return false;
    
    try {
      var evStart = new Date(ev.start);
      var evEnd = new Date(ev.end);
      
      // Verifica sobreposição
      return (startDate < evEnd && endDate > evStart);
    } catch (e) {
      return false;
    }
  });
}

/**
 * ADICIONE ESTAS ROTAS NO router.gs:
 * 
 * No handleApiGet, adicione:
 * 
 *     case '/api/agenda':
 *       return getAgenda(params);
 * 
 * No handleApiPost, adicione:
 * 
 *     case '/api/agenda':
 *       return createAgendaEntry(body);
 *     
 *     case '/api/agenda/update':
 *       return updateAgendaEntry(body.id, body);
 *     
 *     case '/api/agenda/delete':
 *       return deleteAgendaEntry(body.id);
 */
