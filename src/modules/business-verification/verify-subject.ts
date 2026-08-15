// verify-subject: a persona física is usually registered under her own name, not the shop's.

import { SourceResult } from '../../common/types/source-result.types';
import { BusinessVerification, getVerificationStatus } from './business-verification.service';

export type MatchedBy = 'business' | 'holder' | null;

export interface SubjectQuery {
  businessName?: string;
  holderName?: string;
  stateCode?: number;
  rfc?: string;
}

export interface SubjectVerifier {
  verify(input: {
    businessName: string;
    stateCode?: number;
    rfc?: string;
  }): Promise<SourceResult<BusinessVerification>>;
}

export interface SubjectResult {
  result: SourceResult<BusinessVerification> | null;
  matched_by: MatchedBy;
  tried: string[];
}

export async function verifySubject(verifier: SubjectVerifier, query: SubjectQuery): Promise<SubjectResult> {
  const attempts: Array<{ name: string; as: Exclude<MatchedBy, null> }> = [];
  if (query.businessName !== undefined) attempts.push({ name: query.businessName, as: 'business' });
  if (query.holderName !== undefined) attempts.push({ name: query.holderName, as: 'holder' });

  if (attempts.length === 0) return { result: null, matched_by: null, tried: [] };

  const tried: string[] = [];
  let last: SourceResult<BusinessVerification> | null = null;

  for (const attempt of attempts) {
    tried.push(attempt.name);
    const result = await verifier.verify({
      businessName: attempt.name,
      stateCode: query.stateCode,
      rfc: query.rfc,
    });
    last = result;

    if (getVerificationStatus(result) === 'verified') {
      return { result, matched_by: attempt.as, tried };
    }
    // An unreadable directory is not an answer, so a second name would not help.
    if (getVerificationStatus(result) === 'unavailable') break;
  }

  return { result: last, matched_by: null, tried };
}
