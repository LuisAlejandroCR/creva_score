// siem.client: typed wrapper over the establishment directory endpoints.

import { CromaCallable } from '../../../common/http/croma.client';
import { SourceResult, sourceUnavailable } from '../../../common/types/source-result.types';
import { callAndValidate } from '../../../common/http/validated-call';
import {
  EstablishmentDetail,
  EstablishmentSearch,
  EstablishmentSearchParams,
  SIEM_DETAIL_PATH,
  SIEM_SEARCH_PATH,
  SIEM_SOURCE,
  establishmentDetailSchema,
  establishmentSearchSchema,
} from './siem.types';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 200;
const STATE_CODE_MAX = 32;
const ACTIVITY_CODE_MAX = 999999;
const PAGE_MAX = 1000;

export class SiemClient {
  constructor(private readonly croma: CromaCallable) {}

  async searchEstablishments(params: EstablishmentSearchParams): Promise<SourceResult<EstablishmentSearch>> {
    const name = params.name.trim();
    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      return sourceUnavailable<EstablishmentSearch>(SIEM_SOURCE, 'invalid_business_name');
    }

    const body: Record<string, string | number> = { name };
    if (isWithin(params.stateCode, 0, STATE_CODE_MAX)) body.state_code = params.stateCode;
    if (isWithin(params.activityCode, 0, ACTIVITY_CODE_MAX)) body.activity_code = params.activityCode;
    if (isWithin(params.page, 1, PAGE_MAX)) body.page = params.page;

    return callAndValidate(this.croma, SIEM_SEARCH_PATH, body, establishmentSearchSchema, {
      source: SIEM_SOURCE,
      retry: { attempts: 1 },
    });
  }

  async getEstablishment(establishmentId: string): Promise<SourceResult<EstablishmentDetail>> {
    const id = establishmentId.trim();
    if (id.length === 0) {
      return sourceUnavailable<EstablishmentDetail>(SIEM_SOURCE, 'invalid_establishment_id');
    }

    return callAndValidate(
      this.croma,
      SIEM_DETAIL_PATH,
      { establishment_id: id },
      establishmentDetailSchema,
      { source: SIEM_SOURCE, retry: { attempts: 1 } },
    );
  }
}

function isWithin(value: number | undefined, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
