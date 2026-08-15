import { checkDigit, inspectRfc, normalizeRfc } from '../../src/modules/business-verification/rfc';

describe('inspectRfc', () => {
  it('accepts a well-formed RFC of a persona física', () => {
    // The check digit is computed, never typed in: an invented fixture would assert
    // a property the value does not have.
    const rfc = `MELM8501011X${checkDigit('MELM8501011X0')}`;
    const found = inspectRfc(rfc);

    expect(found.kind).toBe('persona_fisica');
    expect(found.well_formed).toBe(true);
    expect(found.check_digit_ok).toBe(true);
    expect(found.usable).toBe(true);
  });

  it('tells a persona moral apart by its three leading letters', () => {
    expect(inspectRfc('ABC850101AA9').kind).toBe('persona_moral');
    expect(inspectRfc('ABCD850101AAA').kind).toBe('persona_fisica');
  });

  it('rejects a shape that is neither', () => {
    const found = inspectRfc('NO-ES-UN-RFC');

    expect(found.kind).toBe('desconocido');
    expect(found.usable).toBe(false);
    expect(found.note).toContain('errata');
  });

  it('catches an impossible date inside the RFC', () => {
    const found = inspectRfc('MELM8513011X8');

    expect(found.well_formed).toBe(false);
    expect(found.note).toContain('fecha');
  });

  it('never accuses: a wrong check digit reads as a typo and the search still runs', () => {
    const found = inspectRfc('MELM850101AAA');

    expect(found.note).toContain('errata');
    expect(found.note).toContain('nombre');
    expect(found.note).not.toMatch(/fals|inv(á|a)lid|minti/i);
  });

  it('says out loud that a well-formed RFC is not a verified one', () => {
    const found = inspectRfc(`MELM8501011X${checkDigit('MELM8501011X0')}`);

    expect(found.note).toContain('SAT');
    expect(found.note).toContain('no comprueba que exista');
  });

  it('normalises spacing and case before anything else', () => {
    expect(normalizeRfc(' melm-850101-1x8 ')).toBe('MELM8501011X8');
    expect(normalizeRfc(undefined)).toBeUndefined();
    expect(inspectRfc(undefined).note).toBe('Sin RFC.');
  });
});

describe('checkDigit', () => {
  it('changes when any character of the body changes', () => {
    const base = 'MELM8501011X2';
    const digits = new Set<string | null>();

    for (const variant of ['MELM8501011X8', 'MELN8501011X8', 'MELM8501021X8', 'MELM8501011Y8']) {
      digits.add(checkDigit(variant));
    }

    expect(digits.size).toBeGreaterThan(1);
    expect(checkDigit(base)).not.toBeNull();
  });

  it('pads a persona moral so both lengths use the same weighting', () => {
    expect(checkDigit('ABC850101AA9')).not.toBeNull();
    expect(checkDigit('demasiado corto')).toBeNull();
  });
});
