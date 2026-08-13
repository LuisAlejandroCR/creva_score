// creva-report.builder: turns what the services returned into the report a viewer consumes.

import {
  CrevaReport,
  ReportSignal,
  ReportSource,
  ReportSubject,
  buildCrevaReport,
} from '../../common/types/creva-report.types';
import { SourceResult } from '../../common/types/source-result.types';
import { BusinessVerification, getVerificationStatus } from '../business-verification/business-verification.service';
import { RegulatoryRadar } from '../regulatory-radar/regulatory-radar.service';
import { ReferenceRates } from '../reference-rates/reference-rates.service';
import { ScoreDisclosure } from '../score-disclosure/score-disclosure.service';

export interface ReportBuilderInput {
  subject: ReportSubject | null;
  verification: SourceResult<BusinessVerification> | null;
  radar: SourceResult<RegulatoryRadar>;
  rates: SourceResult<ReferenceRates>;
  disclosure: ScoreDisclosure;
  now?: () => Date;
}

const VERIFICATION_DETAIL: Record<string, string> = {
  verified: 'Tu negocio aparece en el directorio oficial de establecimientos.',
  not_listed:
    'No encontramos tu negocio en el directorio. El registro es voluntario, así que su ausencia no dice nada sobre él.',
  ambiguous:
    'Encontramos varios negocios con nombres parecidos y no pudimos distinguir cuál es el tuyo. No es lo mismo que no estar registrado.',
  unavailable: 'No pudimos consultar el directorio en este momento. Esto no dice nada sobre tu negocio.',
};

export function buildReport(input: ReportBuilderInput): CrevaReport {
  const signals: ReportSignal[] = [];
  const sources: ReportSource[] = [];

  if (input.verification !== null) {
    const status = getVerificationStatus(input.verification);
    signals.push({
      key: 'business_verification',
      category: 'business_verification',
      label: labelForVerification(status),
      tone: status === 'verified' ? 'positive' : status === 'unavailable' ? 'unavailable' : 'neutral',
      detail: VERIFICATION_DETAIL[status] ?? '',
      source: 'Directorio oficial de establecimientos (SIEM)',
      checked_at: input.verification.checked_at,
      evidence_url: null,
    });
    sources.push({
      provider: 'Croma',
      dataset: 'SIEM · directorio de establecimientos',
      queried_at: input.verification.checked_at,
    });
  }

  if (input.radar.available && input.radar.data !== null) {
    for (const alert of input.radar.data.alerts) {
      signals.push({
        key: `${alert.source}:${alert.external_id}`,
        category: 'regulatory',
        label: alert.kind === 'publication' ? 'Novedad publicada' : 'Regla vigente que aplica',
        tone: 'neutral',
        detail: alert.title,
        source: alert.source === 'mx.dof' ? 'Diario Oficial de la Federación' : 'Normas vigentes de la CNBV',
        checked_at: alert.published_at,
        evidence_url: alert.url,
      });
    }
    for (const available of input.radar.data.sources_available) {
      sources.push({
        provider: 'Croma',
        dataset: available === 'mx.dof' ? 'DOF · publicaciones por fecha' : 'CNBV · normas vigentes',
        queried_at: input.radar.checked_at,
      });
    }
  } else {
    signals.push({
      key: 'regulatory_unavailable',
      category: 'regulatory',
      label: 'Revisión regulatoria no disponible',
      tone: 'unavailable',
      detail: 'No pudimos revisar las publicaciones oficiales en este momento.',
      source: 'Diario Oficial de la Federación · CNBV',
      checked_at: input.radar.checked_at,
      evidence_url: null,
    });
  }

  if (input.rates.available && input.rates.data !== null) {
    for (const rate of input.rates.data.rates) {
      signals.push({
        key: `rate:${rate.series_id}`,
        category: 'reference_rate',
        label: rate.label,
        tone: 'neutral',
        detail: rate.unit === 'percent' ? `${rate.value}%` : `${rate.value} MXN`,
        source: 'Banco de México · SIE',
        checked_at: rate.observed_on,
        evidence_url: null,
      });
    }
    sources.push({ provider: 'Banco de México', dataset: 'SIE · series oportunas', queried_at: input.rates.checked_at });
  }

  return buildCrevaReport({
    subject: input.subject,
    signals,
    sources,
    disclosure: input.disclosure,
    notes: buildNotes(input),
    now: input.now,
  });
}

function labelForVerification(status: string): string {
  if (status === 'verified') return 'Negocio encontrado en el directorio oficial';
  if (status === 'ambiguous') return 'Varios negocios con nombre parecido';
  if (status === 'not_listed') return 'Negocio no listado en el directorio';
  return 'Directorio no disponible';
}

function buildNotes(input: ReportBuilderInput): string[] {
  const notes: string[] = [];

  if (input.radar.available && input.radar.data !== null && input.radar.data.failed_dates.length > 0) {
    notes.push(
      `No pudimos leer ${input.radar.data.failed_dates.length} fecha(s) del diario oficial. Preferimos decirlo a dejarte creer que no había nada.`,
    );
  }
  if (input.rates.available && input.rates.data !== null && input.rates.data.missing_series.length > 0) {
    notes.push('Alguna tasa de referencia no traía dato hoy, y por eso no aparece.');
  }
  if (input.subject === null) {
    notes.push('Esta corrida no consultó ningún negocio. El sello aparece cuando indicas cuál es el tuyo.');
  }
  return notes;
}
