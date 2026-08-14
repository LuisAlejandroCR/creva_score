# Creva Score

**Tu negocio ya tiene historia. Aquí la puedes mostrar.**

Creva Score ayuda a las emprendedoras mexicanas a demostrar que su negocio es real y que funciona — usando registros oficiales que ya existen, para que un banco tenga algo que mirar además de un historial de crédito que todavía no tienen.

---

## El problema

Cuando una mujer abre su negocio y pide su primer crédito, el banco le pide historial. Ella no lo tiene todavía, no porque no venda, sino porque nunca le prestaron. Y como no le prestan, nunca lo construye.

Lo injusto es que la información sí existe: su negocio está en registros públicos y su actividad está declarada. Nadie los junta y nadie los mira.

## Qué hace

Reúne lo que ya se puede saber de su negocio y lo convierte en algo que se entiende y se puede enseñar:

- **Un puntaje que se explica solo.** Cada parte dice de dónde salió y de qué fecha es.
- **Información oficial, no suposiciones.**
- **Cosas que sí puede hacer.** Si algo baja su puntaje, la app le dice qué cambiar.

## Cómo lo hacemos

**Nunca la castigamos por lo que no aparece.** Muchos registros oficiales son voluntarios. Que su negocio no esté ahí no dice nada malo de ella, así que no le resta.

**No usamos antecedentes penales.** Ni de ella, ni de nadie. Es una decisión firme y no va a cambiar.

**Ella decide.** Consultamos sus datos porque ella lo autoriza, le decimos qué y para qué, y puede pedirnos que los borremos.

**Que algo sea público no lo hace nuestro.** Un dato publicado sigue siendo de la persona a la que se refiere.

## México primero, y luego la región

Empezamos en México porque ahí están nuestras usuarias. La misma idea funciona en Colombia y en Perú con los registros de cada país: es el mismo producto mirando otra ventanilla.

## Estado

🚧 **En construcción.** Las dos piezas funcionan de principio a fin contra los registros oficiales reales y su resultado se puede ver en pantalla. Todavía no hay una app que puedas abrir.

**1. El sello de tu negocio.** Busca tu negocio en el directorio oficial de establecimientos y, si está, emite un sello con su fuente y su fecha.

- **Tu puntaje no depende de esto.** Con sello o sin él, es exactamente el mismo.
- **Lo medimos antes de decidirlo.** El directorio cubre muchísimo mejor a unos estados que a otros; si diera puntos, premiaría el código postal.
- **No te damos un sello que no sea tuyo.** Si aparecen varios negocios con nombres parecidos, te lo decimos y no emitimos nada.

**2. Avisos de reglas que te afectan.** Revisa el diario oficial y la lista de reglas vigentes de la autoridad bancaria, y separa lo que toca tu crédito de lo que no.

- **No consulta ningún dato tuyo:** es la misma revisión para todas.
- **Distingue una novedad de una regla que ya existía.**
- **Cada aviso trae su fuente, su fecha y el documento oficial detrás.**
- Si una fuente no responde ese día, lo dice.

**Lo que guardamos.** Los resultados se guardan un rato para no repetir la misma consulta. Se archivan bajo una huella ilegible, no bajo el nombre de tu negocio, y se pueden borrar de verdad.

Construido durante el [IA Hackathon GovTech](https://usecroma.com/es/changelog/hackathon-govtech) (12–16 de agosto de 2026) sobre [Croma](https://usecroma.com), que da acceso a datos de gobierno de México, Colombia y Perú.

## Tus datos

Nuestro Aviso de Privacidad y Términos de Servicio están redactados y en revisión legal. Se publican aquí antes de que el producto se abra al público.

Lo que ya está decidido y no va a cambiar:

- Consultamos registros oficiales **solo sobre tu negocio**, y solo si tú nos autorizas.
- **No consultamos antecedentes penales** de nadie.
- No vendemos tus datos.
- Puedes ver, corregir o borrar tus datos, y retirar tu autorización, cuando quieras.

---

## Para devs

**Requisitos:** Node 20 o superior. CI corre sobre Node 22.

```bash
npm install
cp .env.example .env    # y coloca tu credencial de Croma en CROMA_API_KEY
```

Sin `CROMA_API_KEY` todo arranca igual: cada consulta responde "no disponible" y nada revienta.

### Demo por terminal

```bash
npm run demo
```

Muestra los avisos regulatorios. Para incluir el sello de un negocio:

```bash
node dist/cli/demo.js --negocio "ABARROTES ERENDIRA" --estado 8
```

El estado es opcional pero casi siempre necesario: buscar por nombre sin acotar suele devolver miles de coincidencias, y entonces no se emite sello. En `cmd.exe`, `npm run demo -- --negocio "…"` rompe las comillas.

### Reporte

```bash
node dist/cli/demo.js --negocio "ABARROTES ERENDIRA" --estado 8 --reporte
```

Genera `creva-report.html` y `creva-report.json`. El HTML es **un solo archivo**: no carga nada de internet, no necesita servidor y se abre con doble clic. Los únicos enlaces que salen son a los documentos oficiales citados.

Cuatro etapas —Resumen, Señales, Mercado y Auditoría— con navegación hacia adelante y atrás; lo que abriste o filtraste sigue igual al volver. En **Señales**, elegir una fuente o mover el rango de años filtra a la vez las barras, la línea de tiempo y la evidencia, así que nunca hay dos cifras que se contradigan. **"Ver todo"** despliega las cuatro en una página para buscar con `Ctrl+F`; **"Descargar PDF"** da un resumen ejecutivo de dos páginas; **"Compartir"** abre WhatsApp con cifras públicas, nunca el RFC.

Accesible por teclado y con `prefers-reduced-motion` respetado.

### Usarlo desde un agente (MCP)

Expone sus composiciones como herramientas MCP por stdio:

| Herramienta | Qué devuelve |
|---|---|
| `creva_report` | El reporte completo: todas las señales con su fuente y su fecha, más la ficha de qué **no** estima |
| `creva_verify_business` | Solo el sello del directorio |
| `creva_regulatory_radar` | Solo las reglas y novedades |
| `creva_score_disclosure` | Solo la ficha de declaración |

```bash
npm run mcp
```

Para probarlo sin cliente MCP hay una sonda que hace el saludo del protocolo y, si se lo pides, llama a una herramienta:

```bash
npm run mcp:probe
```

⚠️ El argumento `--args` debe ser JSON válido tal como llega al proceso. En PowerShell las comillas escapadas pasan literales y lo rompen; la sonda te lo dice en vez de callarlo:

```bash
node dist/cli/mcp-probe.js --tool creva_regulatory_radar --args (ConvertTo-Json @{} -Compress)
```

Para conectarlo a un cliente MCP basta la ruta absoluta al servidor; **no hace falta `cwd` ni copiar credenciales**, porque el servidor busca el `.env` del proyecto junto a su propio build:

```json
{
  "mcpServers": {
    "creva-score": {
      "command": "node",
      "args": ["<ruta del repositorio>/dist/modules/mcp/mcp.server.js"]
    }
  }
}
```

### Pruebas

```bash
npm run verify
```

Corre typecheck, lint, las tres suites y el build. Por separado: `npm run test:unit`, `npm run test:fuzz`, `npm run test:invariant`.

Las invariantes sostienen las promesas de arriba: que el sello nunca otorgue puntos, que el RFC no llegue a una llave de caché, que la credencial no salga en un registro, y que el servidor MCP no escriba en el canal del protocolo.

### Consumo de la API

Cuota base de 100 consultas al día para toda la organización, ampliada temporalmente durante el hackathon; el diseño asume la base. Verificar un negocio cuesta 2; el radar cuesta un día de gaceta por fecha revisada más el catálogo. Los resultados se guardan en disco, así que repetir una consulta no gasta cuota.

Algunas consultas se resuelven en segundo plano: el cliente espera lo que la API le indique y ese sondeo no consume la cuota diaria, así que una consulta lenta cuesta lo mismo que una rápida.

## Licencia
