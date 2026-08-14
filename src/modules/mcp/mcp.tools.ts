// mcp.tools: tool definitions exposing this project's compositions over MCP.

import { readFileSync } from 'node:fs';
import { z } from 'zod/v3';
import { buildVerificationBadge } from '../business-verification/business-verification.badge';
import { getVerificationStatus } from '../business-verification/business-verification.service';
import { CrevaScoreSetup } from '../creva-score/creva-score.factory';
import { buildReport } from '../creva-score/creva-report.builder';
import { renderReportHtml } from '../../cli/report';
import { DocumentTools, ReportDocument, buildReportDocument, fileUrl, realTools } from './report-document';
import { formatFolio, reportFolio } from '../../common/integrity/report-digest';
import { SealOutcome, sealFolderOnDisk, verifyFolderOnDisk } from '../attestation/seal-folder';
import { renderScoreDisclosure } from '../score-disclosure/score-disclosure.service';

export type McpContent =
  | { type: 'text'; text: string }
  | { type: 'resource_link'; uri: string; name: string; mimeType: string; description: string }
  | { type: 'resource'; resource: { uri: string; mimeType: string; blob: string } };

export interface McpToolResult {
  [key: string]: unknown;
  content: McpContent[];
  isError?: boolean;
}

export interface McpToolDefinition<Shape extends z.ZodRawShape> {
  name: string;
  config: { title: string; description: string; inputSchema: Shape };
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<McpToolResult>;
}

const verifyBusinessShape = {
  business_name: z
    .string()
    .min(2)
    .max(200)
    .describe('Nombre comercial o razón social del negocio, tal como está registrado.'),
  state_code: z
    .number()
    .int()
    .min(0)
    .max(32)
    .optional()
    .describe('Código INEGI de la entidad federativa. Acota una búsqueda que suele traer miles de resultados.'),
  rfc: z.string().optional().describe('RFC del negocio. Si se envía, se usa para confirmar que el registro es el correcto.'),
};

const reportShape = {
  business_name: z
    .string()
    .min(2)
    .max(200)
    .optional()
    .describe('Nombre del negocio. Si se omite, el reporte sale sin sello y lo dice.'),
  state_code: z
    .number()
    .int()
    .min(0)
    .max(32)
    .optional()
    .describe('Código INEGI de la entidad federativa.'),
  rfc: z.string().optional().describe('RFC del negocio. Se compara en local; nunca se envía al proveedor.'),
  document: z
    .boolean()
    .optional()
    .describe(
      'Por defecto genera los dos archivos —la página interactiva y el resumen ejecutivo en PDF— y devuelve dónde quedaron. Ponlo en false solo si se pidió el reporte sin archivos.',
    ),
  embed: z
    .boolean()
    .optional()
    .describe('Si es true, adjunta el PDF en la respuesta. Pesa mucho: pídelo solo si el cliente lo necesita incrustado.'),
};

const radarShape = {};
const disclosureShape = {};

const NOTE_BY_STATUS: Record<'verified' | 'not_listed' | 'ambiguous', string> = {
  verified: 'Sello emitido: el negocio se identificó sin ambigüedad.',
  not_listed:
    'Sin sello: no se encontró el negocio. El directorio es voluntario, así que la ausencia no es evidencia de nada.',
  ambiguous:
    'Sin sello: se encontraron varios negocios con nombres parecidos y no se pudo identificar cuál es. No es lo mismo que no estar registrado. Acota con state_code o envía el rfc.',
};

// Tool results now carry links and blobs too, so callers ask for the text explicitly.
export function textOf(result: McpToolResult): string {
  return result.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

function text(value: string, isError = false): McpToolResult {
  return { content: [{ type: 'text', text: value }], ...(isError && { isError: true }) };
}

export function buildVerifyBusinessTool(
  setup: CrevaScoreSetup,
): McpToolDefinition<typeof verifyBusinessShape> {
  return {
    name: 'creva_verify_business',
    config: {
      title: 'Verificar un negocio en el directorio oficial',
      description:
        'Busca un negocio mexicano en el directorio de establecimientos del SIEM y, si lo identifica sin ambigüedad, devuelve un sello con la fuente y la fecha de consulta. El registro en ese directorio es voluntario: no aparecer no es señal de nada, y el resultado nunca modifica un puntaje de crédito.',
      inputSchema: verifyBusinessShape,
    },
    async handler(args) {
      const result = await setup.service.verify({
        businessName: args.business_name,
        stateCode: args.state_code,
        rfc: args.rfc,
      });

      const status = getVerificationStatus(result);
      if (status === 'unavailable') {
        return text(
          JSON.stringify(
            {
              status,
              message: 'No se pudo consultar el directorio. Esto no dice nada sobre el negocio.',
              reason: result.error ?? 'unknown',
            },
            null,
            2,
          ),
          true,
        );
      }

      return text(
        JSON.stringify(
          {
            status,
            badge: buildVerificationBadge(result),
            candidates_found: result.data?.candidates_found ?? 0,
            checked_at: result.checked_at,
            source: result.source,
            note: NOTE_BY_STATUS[status],
          },
          null,
          2,
        ),
      );
    },
  };
}

export function buildRegulatoryRadarTool(
  setup: CrevaScoreSetup,
): McpToolDefinition<typeof radarShape> {
  return {
    name: 'creva_regulatory_radar',
    config: {
      title: 'Novedades regulatorias relevantes para un negocio pequeño',
      description:
        'Revisa las publicaciones recientes del Diario Oficial de la Federación y el catálogo de normas de la CNBV, y devuelve las que coinciden con los temas configurados. No recibe ni consulta datos de ninguna persona.',
      inputSchema: radarShape,
    },
    async handler() {
      const result = await setup.radar.scan();

      if (!result.available || result.data === null) {
        return text(
          JSON.stringify(
            { status: 'unavailable', message: 'No se pudo consultar ninguna fuente.', reason: result.error ?? 'unknown' },
            null,
            2,
          ),
          true,
        );
      }

      return text(
        JSON.stringify(
          {
            status: 'ok',
            alerts: result.data.alerts,
            scanned_dates: result.data.scanned_dates,
            failed_dates: result.data.failed_dates,
            sources_available: result.data.sources_available,
            sources_unavailable: result.data.sources_unavailable,
            checked_at: result.checked_at,
          },
          null,
          2,
        ),
      );
    },
  };
}

export function describeSeal(seal: SealOutcome): string {
  if (seal.certificate === null) return `Sello no escrito: ${seal.note}`;

  const folio = seal.certificate.report_folio;

  return [
    `Sello     ${seal.certificatePath}`,
    ...(folio === null ? [] : [`Folio     ${formatFolio(folio)}`]),
    `Huella    ${seal.certificate.seal_hash}`,
    'Cualquier cambio de un byte en los archivos rompe esta huella, así que quien los reciba puede comprobar que son los originales.',
    'Comprueba integridad, no autoría: no acredita por sí solo quién emitió el reporte.',
  ].join('\n');
}

export function describeDocument(document: ReportDocument): string {
  const kb = (bytes: number): number => Math.max(1, Math.round(bytes / 1024));
  const lines = [`Carpeta   ${document.folder}`];

  if (document.kind === 'pdf') lines.push(`PDF       ${document.path} · ${kb(document.bytes)} KB`);
  lines.push(`Página    ${document.htmlPath} · ${kb(document.htmlBytes)} KB`);

  return [...lines, '', document.note].join('\n');
}

export function buildReportTool(
  setup: CrevaScoreSetup,
  documentTools: DocumentTools = realTools,
): McpToolDefinition<typeof reportShape> {
  return {
    name: 'creva_report',
    config: {
      title: 'Reporte completo de verificación pública',
      description:
        'Devuelve el reporte entero de un negocio: las señales encontradas en cada registro de gobierno, cada una con su fuente y su fecha, las fuentes consultadas, y la ficha de qué describe el puntaje y qué NO estima. Es la herramienta para "dame el reporte": guarda los dos archivos en una carpeta de Descargas —la página interactiva y el resumen ejecutivo en PDF— y devuelve la ruta de cada uno. No emite un veredicto ni una recomendación de crédito.',
      inputSchema: reportShape,
    },
    async handler(args) {
      const verification =
        args.business_name === undefined
          ? null
          : await setup.service.verify({
              businessName: args.business_name,
              stateCode: args.state_code,
              rfc: args.rfc,
            });

      const report = buildReport({
        subject:
          args.business_name === undefined
            ? null
            : { business_name: args.business_name, state_code: args.state_code ?? null },
        verification,
        radar: await setup.radar.scan(),
        rates: await setup.rates.getRates(),
        disclosure: setup.disclosure,
      });

      const content: McpContent[] = [];

      if (args.document !== false) {
        const document = await buildReportDocument(
          renderReportHtml(report),
          report.subject?.business_name ?? 'revision-general',
          report.generated_at,
          documentTools,
        );

        const seal = sealFolderOnDisk(
          document.folder,
          document.kind === 'pdf' ? ['creva-reporte.html', 'creva-reporte.pdf'] : ['creva-reporte.html'],
          report.generated_at,
          reportFolio(report),
        );

        content.push({ type: 'text', text: `${describeDocument(document)}\n\n${describeSeal(seal)}` });

        if (document.kind === 'pdf') {
          content.push({
            type: 'resource_link',
            uri: fileUrl(document.path),
            name: 'creva-reporte.pdf',
            mimeType: 'application/pdf',
            description: document.note,
          });
        }

        content.push({
          type: 'resource_link',
          uri: fileUrl(document.htmlPath),
          name: 'creva-reporte.html',
          mimeType: 'text/html',
          description: 'Reporte interactivo completo: cada señal con su fuente y su fecha.',
        });

        if (args.embed === true) {
          content.push({
            type: 'resource',
            resource: {
              uri: fileUrl(document.path),
              mimeType: document.kind === 'pdf' ? 'application/pdf' : 'text/html',
              blob: readFileSync(document.path).toString('base64'),
            },
          });
        }
      }

      content.push({ type: 'text', text: JSON.stringify(report, null, 2) });
      return { content };
    },
  };
}

const verifyDocumentShape = {
  folder: z
    .string()
    .min(1)
    .describe('Ruta de la carpeta del reporte, la que contiene creva-sello.json y los archivos entregados.'),
};

export function buildVerifyDocumentTool(): McpToolDefinition<typeof verifyDocumentShape> {
  return {
    name: 'creva_verify_document',
    config: {
      title: 'Comprobar que un reporte no fue alterado',
      description:
        'Recibe la carpeta de un reporte de Creva y comprueba, archivo por archivo, que sus bytes son exactamente los que se generaron. Si el reporte se ancló en una cadena pública, además confirma la transacción. Sirve para que quien recibe el documento —un banco, por ejemplo— pueda verificarlo sin confiar en quien se lo entregó. Distingue tres cosas y nunca las mezcla: archivo íntegro, archivo alterado, y no se pudo consultar la cadena.',
      inputSchema: verifyDocumentShape,
    },
    async handler(args) {
      const outcome = verifyFolderOnDisk(args.folder);

      if ('error' in outcome) return text(outcome.error, true);

      const { certificate, result } = outcome;
      const altered = !result.files_intact;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                files_intact: result.files_intact,
                files: result.files.map((file) => ({ name: file.name, verdict: file.verdict })),
                seal_is_self_consistent: result.seal_is_self_consistent,
                seal_hash: certificate.seal_hash,
                report_folio: certificate.report_folio,
                generated_at: certificate.generated_at,
                does_not_prove: certificate.does_not_prove,
              },
              null,
              2,
            ),
          },
        ],
        // An altered document is a finding, not a tool failure, so it is reported without isError.
        ...(altered && { isError: false }),
      };
    },
  };
}

export function buildScoreDisclosureTool(
  setup: CrevaScoreSetup,
): McpToolDefinition<typeof disclosureShape> {
  return {
    name: 'creva_score_disclosure',
    config: {
      title: 'Qué declara el puntaje de Creva, y qué no',
      description:
        'Devuelve la ficha del puntaje: qué describe, sobre qué ventana de tiempo, qué NO estima, y cómo se marca la procedencia de cada dato que lo alimenta. El puntaje es descriptivo: no estima probabilidad de impago ni sustituye un historial crediticio.',
      inputSchema: disclosureShape,
    },
    async handler() {
      return text(JSON.stringify(setup.disclosure, null, 2));
    },
  };
}

export function renderDisclosureForHumans(setup: CrevaScoreSetup): string {
  return renderScoreDisclosure(setup.disclosure);
}
