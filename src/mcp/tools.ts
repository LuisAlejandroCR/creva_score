// mcp.tools: tool definitions exposing this project's compositions over MCP.

import { z } from 'zod/v3';
import { buildVerificationBadge } from '../business-verification/business-verification.badge';
import { getVerificationStatus } from '../business-verification/business-verification.service';
import { BusinessVerificationSetup } from '../index';

export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
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

const radarShape = {};

function text(value: string, isError = false): McpToolResult {
  return { content: [{ type: 'text', text: value }], ...(isError && { isError: true }) };
}

export function buildVerifyBusinessTool(
  setup: BusinessVerificationSetup,
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

      const badge = buildVerificationBadge(result);
      return text(
        JSON.stringify(
          {
            status,
            badge,
            candidates_found: result.data?.candidates_found ?? 0,
            checked_at: result.checked_at,
            source: result.source,
            note:
              badge === null
                ? 'Sin sello. El directorio es voluntario, así que la ausencia no es evidencia de nada.'
                : 'Sello emitido: el negocio se identificó sin ambigüedad.',
          },
          null,
          2,
        ),
      );
    },
  };
}

export function buildRegulatoryRadarTool(
  setup: BusinessVerificationSetup,
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
