export const generateRegistrationFingerprint = (student: any, eventId: string): string => {
  // Normalize Program
  const program = String(student.programType || student.program || '').toLowerCase().trim();

  // Normalize Event ID
  const event = String(eventId || '').trim();

  // Normalize Mobile: keep only digits, and ideally grab the last 10 if there's a country code
  let mobile = String(student.whatsapp || student.contact || '');
  mobile = mobile.replace(/\D/g, '');
  if (mobile.length > 10 && mobile.startsWith('91')) {
    mobile = mobile.slice(-10);
  }

  // Normalize Student Name
  let name = String(student.name || '').toLowerCase();
  name = name.replace(/[^a-z0-9]/g, ''); // remove spaces and special characters entirely for strictest matching

  // Normalize Belt / Stage
  let beltOrStage = '';
  if (program === 'karate') {
    beltOrStage = String(student.beltLevel || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  } else {
    beltOrStage = String(student.stageLevel || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Normalize Standard
  const standard = String(student.standard || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return `${program}|${event}|${mobile}|${name}|${beltOrStage}|${standard}`;
};
