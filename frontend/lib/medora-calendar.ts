import type { Appointment } from './medora-demo';

const escapeText = (s: string) => s.replace(/\r\n?/g, '\n').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
function foldLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let part = ''; let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { parts.push(part); part = ' '; bytes = 1; }
    part += char; bytes += size;
  }
  parts.push(part);
  return parts.join('\r\n');
}
export function buildVisitCalendar(a: Appointment, reminder = true) {
  const start = `${a.date.replaceAll('-', '')}T${a.time.replace(':', '')}00`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Medora//Frontend Demo//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${a.id}@medora.demo`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`, `DTSTART:${start}`, 'DURATION:PT30M', `SUMMARY:${escapeText('Demo: ' + a.specialty + ' consultation')}`, `LOCATION:${escapeText(a.provider)}`, `DESCRIPTION:${escapeText('Fictional Medora appointment. ' + a.doctor + '. ' + a.reason)}`, ...(reminder ? ['BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Medora sample appointment reminder', 'END:VALARM'] : []), 'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
export function parseCalendarEntry(text: string) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const event = unfolded.match(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/i)?.[1];
  if (!event) throw new Error('This file has no calendar event.');
  const value = (key: string) => {
    const row = event.split(/\r?\n/).find(x => x.split(/[;:]/)[0].toUpperCase() === key);
    return row?.slice(row.indexOf(':') + 1).replace(/\\([nN,;\\])/g, (_, char: string) => /n/i.test(char) ? '\n' : char) || '';
  };
  const match = value('DTSTART').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!match) throw new Error('This event does not have a supported date.');
  let date = `${match[1]}-${match[2]}-${match[3]}`;
  let time = `${match[4] || '09'}:${match[5] || '00'}`;
  const validationDate = new Date(date + 'T12:00:00Z');
  if (Number.isNaN(validationDate.getTime()) || validationDate.toISOString().slice(0, 10) !== date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || Number(match[6] || 0) > 59) throw new Error('Invalid event date or time.');
  if (match[7]) {
    const d = new Date(`${date}T${time}:${match[6] || '00'}Z`);
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return { title: value('SUMMARY') || 'Imported calendar appointment', clinic: value('LOCATION') || 'External calendar entry', description: value('DESCRIPTION'), date, time };
}
