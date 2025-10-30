/**
 * Parse de data/hora ISO LOCAL (Brasília/São Paulo UTC-3)
 * Converte string datetime-local para Date no fuso correto
 */
function parseLocalISO(iso){ try{ if(!iso) return null; var m=String(iso).match(/^(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2})/); if(m){ return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0); } var d=new Date(iso); return isNaN(d.getTime())?null:d; }catch(e){ return null; } }
