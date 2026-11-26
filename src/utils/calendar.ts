export function downloadDoomsdayCalendarEvent(): void {
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Avengers Doomsday Fan Experience//EN',
    'BEGIN:VEVENT',
    'UID:avengers-doomsday-2026-release@doomsday-fan',
    'DTSTAMP:20261126T000000Z',
    'DTSTART;VALUE=DATE:20261217',
    'DTEND;VALUE=DATE:20261218',
    'SUMMARY:Avengers: Doomsday — Theatrical Release',
    'DESCRIPTION:Marvel Studios Avengers: Doomsday arrives in theaters & IMAX. All realities fracture. Only Doom endures.',
    'LOCATION:In Theaters & IMAX',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'avengers-doomsday-release.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
