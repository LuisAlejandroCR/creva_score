import { sourceOk, sourceUnavailable } from '../../src/common/types/source-result.types';
import { BusinessVerification } from '../../src/modules/business-verification/business-verification.service';
import { SubjectVerifier, verifySubject } from '../../src/modules/business-verification/verify-subject';

function found(name: string): ReturnType<typeof sourceOk<BusinessVerification>> {
  return sourceOk('mx.siem', {
    matched: true,
    confirmed_by_rfc: false,
    establishment_id: '1',
    commercial_name: name,
    state: 'Puebla',
    candidates_found: 1,
  });
}

const absent = sourceOk<BusinessVerification>('mx.siem', {
  matched: false,
  confirmed_by_rfc: false,
  establishment_id: null,
  commercial_name: null,
  state: null,
  candidates_found: 0,
});

function verifier(byName: Map<string, ReturnType<typeof sourceOk<BusinessVerification>>>): {
  verifier: SubjectVerifier;
  asked: string[];
} {
  const asked: string[] = [];
  return {
    asked,
    verifier: {
      async verify(input) {
        asked.push(input.businessName);
        return byName.get(input.businessName) ?? absent;
      },
    },
  };
}

describe('verifySubject', () => {
  it('finds the holder when the shop name is not in the directory', async () => {
    // The case that matters: a persona física registered under her own name.
    const { verifier: v, asked } = verifier(new Map([['ANDREA RAMIREZ', found('ANDREA RAMIREZ')]]));
    const outcome = await verifySubject(v, { businessName: 'MAGNIFIQUE STUDIO', holderName: 'ANDREA RAMIREZ' });

    expect(outcome.matched_by).toBe('holder');
    expect(asked).toEqual(['MAGNIFIQUE STUDIO', 'ANDREA RAMIREZ']);
  });

  it('prefers the shop name and never asks twice when it already matched', async () => {
    const { verifier: v, asked } = verifier(new Map([['MAGNIFIQUE STUDIO', found('MAGNIFIQUE STUDIO')]]));
    const outcome = await verifySubject(v, { businessName: 'MAGNIFIQUE STUDIO', holderName: 'ANDREA RAMIREZ' });

    expect(outcome.matched_by).toBe('business');
    expect(asked).toEqual(['MAGNIFIQUE STUDIO']);
  });

  it('stops after an unreadable directory instead of spending a second query', async () => {
    // Quota is the scarce thing; a second name cannot fix a source that is down.
    const { verifier: v, asked } = verifier(
      new Map([['MAGNIFIQUE STUDIO', sourceUnavailable<BusinessVerification>('mx.siem', 'http_502')]]),
    );
    const outcome = await verifySubject(v, { businessName: 'MAGNIFIQUE STUDIO', holderName: 'ANDREA RAMIREZ' });

    expect(asked).toEqual(['MAGNIFIQUE STUDIO']);
    expect(outcome.matched_by).toBeNull();
  });

  it('reports no match without inventing one, and says what it tried', async () => {
    const { verifier: v } = verifier(new Map());
    const outcome = await verifySubject(v, { businessName: 'A', holderName: 'B' });

    expect(outcome.matched_by).toBeNull();
    expect(outcome.tried).toEqual(['A', 'B']);
    expect(outcome.result).not.toBeNull();
  });

  it('answers with nothing when neither name was given', async () => {
    const { verifier: v, asked } = verifier(new Map());
    const outcome = await verifySubject(v, {});

    expect(outcome).toEqual({ result: null, matched_by: null, tried: [] });
    expect(asked).toEqual([]);
  });

  it('works with only a holder name', async () => {
    const { verifier: v, asked } = verifier(new Map([['ANDREA RAMIREZ', found('ANDREA RAMIREZ')]]));
    const outcome = await verifySubject(v, { holderName: 'ANDREA RAMIREZ' });

    expect(outcome.matched_by).toBe('holder');
    expect(asked).toEqual(['ANDREA RAMIREZ']);
  });
});
