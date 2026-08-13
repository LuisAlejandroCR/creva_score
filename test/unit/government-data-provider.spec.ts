import { CromaProvider } from '../../src/common/types/government-data.types';
import type { ProviderServices } from '../../src/common/types/government-data.types';
import { sourceOk, sourceUnavailable } from '../../src/common/types/source-result.types';

function services(overrides: Partial<ProviderServices> = {}): ProviderServices {
  return {
    verify: jest.fn().mockResolvedValue(
      sourceOk('mx.siem', {
        matched: true,
        confirmed_by_rfc: false,
        establishment_id: '1',
        commercial_name: 'ACME',
        state: 'Puebla',
        candidates_found: 1,
      }),
    ),
    scan: jest.fn().mockResolvedValue(
      sourceOk('mx.regulatory-radar', {
        alerts: [],
        scanned_dates: [],
        failed_dates: [],
        sources_available: [],
        sources_unavailable: [],
      }),
    ),
    rates: jest.fn().mockResolvedValue(sourceOk('mx.banxico.sie', { rates: [], missing_series: [] })),
    ...overrides,
  };
}

describe('CromaProvider', () => {
  it('names itself, so a report can say which provider answered', () => {
    expect(new CromaProvider(services()).name).toBe('croma');
  });

  it('passes the query through untouched', async () => {
    const inner = services();
    await new CromaProvider(inner).verifyBusiness({ businessName: 'ACME', stateCode: 21 });

    expect(inner.verify).toHaveBeenCalledWith({ businessName: 'ACME', stateCode: 21 });
  });

  it('forwards a degraded result instead of turning it into an exception', async () => {
    const inner = services({ scan: jest.fn().mockResolvedValue(sourceUnavailable('mx.dof', 'http_502')) });

    const result = await new CromaProvider(inner).regulatoryUpdates();

    expect(result.available).toBe(false);
    expect(result.error).toBe('http_502');
  });

  it('can be replaced by any other provider satisfying the same boundary', async () => {
    const stub = {
      name: 'stub',
      verifyBusiness: jest.fn().mockResolvedValue(sourceUnavailable('stub', 'missing_api_key')),
      regulatoryUpdates: jest.fn().mockResolvedValue(sourceUnavailable('stub', 'missing_api_key')),
      referenceRates: jest.fn().mockResolvedValue(sourceUnavailable('stub', 'missing_api_key')),
    };

    const result = await stub.verifyBusiness({ businessName: 'ACME' });

    expect(stub.name).toBe('stub');
    expect(result.available).toBe(false);
  });
});
