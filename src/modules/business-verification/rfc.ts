// rfc: what can be checked about an RFC without asking anyone.

export type RfcKind = 'persona_fisica' | 'persona_moral' | 'desconocido';

export interface RfcInspection {
  normalized: string | null;
  kind: RfcKind;
  well_formed: boolean;
  check_digit_ok: boolean;
  usable: boolean;
  note: string;
}

// The order the SAT assigns to each character when weighting the RFC.
const ALPHABET = '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ';
const PERSONA_FISICA = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/;
const PERSONA_MORAL = /^[A-ZÑ&]{3}\d{6}[A-Z\d]{3}$/;

export function normalizeRfc(rfc: string | undefined): string | undefined {
  if (typeof rfc !== 'string') return undefined;
  const normalized = rfc.replace(/[\s-]/g, '').toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function inspectRfc(rfc: string | undefined): RfcInspection {
  const normalized = normalizeRfc(rfc) ?? null;

  if (normalized === null) {
    return {
      normalized: null,
      kind: 'desconocido',
      well_formed: false,
      check_digit_ok: false,
      usable: false,
      note: 'Sin RFC.',
    };
  }

  const kind: RfcKind = PERSONA_FISICA.test(normalized)
    ? 'persona_fisica'
    : PERSONA_MORAL.test(normalized)
      ? 'persona_moral'
      : 'desconocido';

  if (kind === 'desconocido') {
    return {
      normalized,
      kind,
      well_formed: false,
      check_digit_ok: false,
      usable: false,
      note: 'El RFC no tiene la forma de 13 caracteres (persona física) ni de 12 (persona moral). Revísalo por si hay una errata.',
    };
  }

  if (!hasPlausibleDate(normalized, kind)) {
    return {
      normalized,
      kind,
      well_formed: false,
      check_digit_ok: false,
      usable: false,
      note: 'La fecha dentro del RFC no existe. Revísalo por si hay una errata.',
    };
  }

  const expected = checkDigit(normalized);
  const matches = expected !== null && expected === normalized.slice(-1);

  return {
    normalized,
    kind,
    well_formed: true,
    check_digit_ok: matches,
    usable: matches,
    note: matches
      ? 'El RFC está bien formado. Eso no comprueba que exista ni de quién es: para eso hace falta el registro del SAT.'
      : 'El último carácter no corresponde al resto del RFC, así que probablemente hay una errata. Se buscará por nombre de todos modos.',
  };
}

export function checkDigit(rfc: string): string | null {
  const body = rfc.slice(0, -1);
  // The weighting expects twelve characters, so a persona moral is padded on the left.
  const padded = body.length === 11 ? ` ${body}` : body;
  if (padded.length !== 12) return null;

  let sum = 0;
  for (let index = 0; index < padded.length; index++) {
    const value = ALPHABET.indexOf(padded[index] as string);
    if (value < 0) return null;
    sum += value * (13 - index);
  }

  const remainder = sum % 11;
  if (remainder === 0) return '0';
  if (remainder === 1) return 'A';
  return String(11 - remainder);
}

function hasPlausibleDate(rfc: string, kind: RfcKind): boolean {
  const start = kind === 'persona_fisica' ? 4 : 3;
  const year = Number(rfc.slice(start, start + 2));
  const month = Number(rfc.slice(start + 2, start + 4));
  const day = Number(rfc.slice(start + 4, start + 6));

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  // Two-digit years are ambiguous by design, so only the day-of-month is checked
  // against the month, taking the leap-year case as valid.
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (daysInMonth[month - 1] as number) && Number.isFinite(year);
}
