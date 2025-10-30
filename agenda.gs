/**
 * agenda.gs - Agenda de atendimentos (calendário)
 * Funções: getAgenda, createAgendaEntry
 * Integra com Google Calendar (CalendarApp) no calendário padrão do usuário.
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

function getAgenda(params) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  ensureAgendaSheet();
  var start = params && params.start ? new Date(params.start) : null;
  var end = params && params.end ? new Date(params.end) : null;
  var professionalId = params && params.professional_id ? params.professional_id : '';

  var events = listRecords('Agenda', {});
  if (!Array.isArray(events)) events = [];

  // filtro por período e profissional
  var filtered = events.filter(function(ev){
    try{
      if(start && new Date(ev.end) < start) return false;
      if(end && new Date(ev.start) > end) return false;
      if(professionalId && ev.professional_id !== professionalId) return false;
      return true;
    }catch(e){ return false; }
  });
  return { success: true, data: filtered };
}

function parseLocalISO(iso){
  try{
    if(!iso) return null;
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if(m){ return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0); }
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }catch(e){ return null; }
}function createAgendaEntry(body) {
  requireRole(['FISIO', 'COORD', 'ADMIN']);
  ensureAgendaSheet();
  if(!body || !body.patient_id || !body.start || !body.end){
    throw new Error('Parâmetros obrigatórios: patient_id, start, end');
  }
  var entry = {
    id: uuid(),
    patient_id: body.patient_id,
    professional_id: body.professional_id || '',
    title: body.title || 'Sessão de fisioterapia',
    start: body.start,
    end: body.end,
    created_by: Session.getActiveUser().getEmail(),
    created_at: nowISO(),
    calendar_event_id: ''
  };

  // Insere no Google Calendar do usuário (tolerante a falhas de permissão)
  try {
    var cal = CalendarApp.getDefaultCalendar();
    var patient = getById('Patients', entry.patient_id) || {};
    var ev = cal.createEvent(entry.title, parseLocalISO(entry.start), parseLocalISO(entry.end), {
      description: 'Paciente: ' + (patient.full_name || entry.patient_id)
    });
    entry.calendar_event_id = ev.getId();
  } catch (e) {
    Logger.log('[createAgendaEntry] Falha ao criar evento no Calendar: ' + e.message);
  }

  appendRow('Agenda', entry);
  logAudit('CREATE', 'Agenda', entry.id, { patient_id: entry.patient_id });
  return { success: true, data: entry };
}





