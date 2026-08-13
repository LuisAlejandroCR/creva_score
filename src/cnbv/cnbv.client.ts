// cnbv.client: typed wrapper over the banking rulebook endpoint.

import { CromaCallable } from '../infra/croma-client';
import { SourceResult } from '../infra/types';
import { callAndValidate } from '../infra/validated-call';
import { CNBV_REGULATIONS_PATH, CNBV_SOURCE, CnbvRegulations, cnbvRegulationsSchema } from './cnbv.schemas';

const PAGE_MAX = 1000;

export interface CnbvRegulationsParams {
  query?: string;
  page?: number;
}

export class CnbvClient {
  constructor(private readonly croma: CromaCallable) {}

  async getAllRegulations(maxPages: number): Promise<SourceResult<CnbvRegulations>> {
    const first = await this.getRegulations();
    if (!first.available || first.data === null) return first;

    const pages = Math.min(first.data.pagination.total_pages, maxPages);
    const regulations = [...first.data.regulations];

    for (let page = 2; page <= pages; page++) {
      const next = await this.getRegulations({ page });
      if (!next.available || next.data === null) break;
      regulations.push(...next.data.regulations);
    }

    return { ...first, data: { ...first.data, regulations } };
  }

  async getRegulations(params: CnbvRegulationsParams = {}): Promise<SourceResult<CnbvRegulations>> {
    const body: Record<string, string | number> = {};

    const query = params.query?.trim();
    if (query) body.query = query;
    if (
      typeof params.page === 'number' &&
      Number.isInteger(params.page) &&
      params.page >= 1 &&
      params.page <= PAGE_MAX
    ) {
      body.page = params.page;
    }

    return callAndValidate(this.croma, CNBV_REGULATIONS_PATH, body, cnbvRegulationsSchema, {
      source: CNBV_SOURCE,
      retry: { attempts: 1 },
    });
  }
}
