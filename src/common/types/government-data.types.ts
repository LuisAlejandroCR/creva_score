// government-data-provider: the boundary the report depends on. See B15.

import { SourceResult } from './source-result.types';
import { BusinessVerification, BusinessVerificationInput } from '../../modules/business-verification/business-verification.service';
import { RegulatoryRadar } from '../../modules/regulatory-radar/regulatory-radar.service';
import { ReferenceRates } from '../../modules/reference-rates/reference-rates.service';

export interface GovernmentDataProvider {
  readonly name: string;
  verifyBusiness(input: BusinessVerificationInput): Promise<SourceResult<BusinessVerification>>;
  regulatoryUpdates(): Promise<SourceResult<RegulatoryRadar>>;
  referenceRates(): Promise<SourceResult<ReferenceRates>>;
}

export interface ProviderServices {
  verify(input: BusinessVerificationInput): Promise<SourceResult<BusinessVerification>>;
  scan(): Promise<SourceResult<RegulatoryRadar>>;
  rates(): Promise<SourceResult<ReferenceRates>>;
}

export class CromaProvider implements GovernmentDataProvider {
  readonly name = 'croma';

  constructor(private readonly services: ProviderServices) {}

  verifyBusiness(input: BusinessVerificationInput): Promise<SourceResult<BusinessVerification>> {
    return this.services.verify(input);
  }

  regulatoryUpdates(): Promise<SourceResult<RegulatoryRadar>> {
    return this.services.scan();
  }

  referenceRates(): Promise<SourceResult<ReferenceRates>> {
    return this.services.rates();
  }
}
