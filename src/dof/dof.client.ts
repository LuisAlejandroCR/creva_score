// dof.client: typed wrapper over the federal gazette endpoint. One request per gazette date.

import { CromaCallable } from '../infra/croma-client';
import { SourceResult, sourceUnavailable } from '../infra/types';
import { callAndValidate } from '../infra/validated-call';
import {
  DOF_PUBLICATIONS_BY_DATE_PATH,
  DOF_SOURCE,
  DofPublicationsByDate,
  dofPublicationsByDateSchema,
} from './dof.schemas';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class DofClient {
  constructor(private readonly croma: CromaCallable) {}

  async getPublicationsByDate(date: string): Promise<SourceResult<DofPublicationsByDate>> {
    if (!ISO_DATE.test(date)) {
      return sourceUnavailable<DofPublicationsByDate>(DOF_SOURCE, 'invalid_date');
    }

    return callAndValidate(this.croma, DOF_PUBLICATIONS_BY_DATE_PATH, { date }, dofPublicationsByDateSchema, {
      source: DOF_SOURCE,
      retry: { attempts: 1 },
    });
  }
}
