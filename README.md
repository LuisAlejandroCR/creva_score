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

🚧 **En construcción.** Las tres piezas funcionan de principio a fin contra los registros oficiales reales y su resultado se puede ver en pantalla. Todavía no hay una app que puedas abrir.

**1. El sello de tu negocio.** Busca tu negocio en el directorio oficial de establecimientos y, si está, emite un sello con su fuente y su fecha.

- **Tu puntaje no depende de esto.** Con sello o sin él, es exactamente el mismo.
- **Lo medimos antes de decidirlo.** El directorio cubre muchísimo mejor a unos estados que a otros; si diera puntos, premiaría el código postal.
- **No te damos un sello que no sea tuyo.** Si aparecen varios negocios con nombres parecidos, te lo decimos y no emitimos nada.

**2. Avisos de reglas que te afectan.** Revisa el diario oficial y la lista de reglas vigentes de la autoridad bancaria, y separa lo que toca tu crédito de lo que no.

- **No consulta ningún dato tuyo:** es la misma revisión para todas.
- **Distingue una novedad de una regla que ya existía.**
- **Cada aviso trae su fuente, su fecha y el documento oficial detrás.**
- Si una fuente no responde ese día, lo dice.

**3. Un reporte que no se puede falsificar.** Cuando generas tu reporte, se guarda junto a él la huella digital de cada archivo.

- **Si alguien le cambia un solo byte, se nota.** Una cifra movida, una fecha cambiada, un "Sin sello" convertido en "Verificado": la huella deja de coincidir.
- **Va firmado por Creva**, con una llave que solo nosotros tenemos: nadie más puede emitir un reporte que se haga pasar por uno tuyo.
- **El banco lo comprueba sin pedirte nada.**
- **Tu reporte lleva un folio a la vista**, para que tu banco pueda pedírtelo y contrastarlo.

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

**Si estás dada de alta como persona física**, tu registro suele ir a tu nombre y no al del negocio. Para eso está `--titular`:

```bash
node dist/cli/demo.js --negocio "MAGNIFIQUE STUDIO" --titular "TU NOMBRE COMPLETO" --estado 21
```

Busca primero por el nombre del negocio y, si no aparece, por el tuyo — y te dice cuál de los dos coincidió. Si das el nombre del negocio y ese basta, no gasta la segunda consulta.

El `--rfc` se revisa antes de salir a la red: si el último carácter no corresponde al resto, te avisa de la posible errata **y busca por nombre de todos modos**. Un RFC bien formado no es un RFC verificado — comprobar que existe requiere el SAT, que no está disponible.

### Reporte

```bash
node dist/cli/demo.js --negocio "ABARROTES ERENDIRA" --estado 8 --reporte
```

Deja los archivos en **tu carpeta de Descargas**, dentro de una carpeta por reporte: `Creva_Score_<negocio>_<fecha y hora>`. Así dos corridas nunca se pisan y siempre se sabe de cuándo es cada una — la hora del nombre es la misma que el reporte lleva dentro. El HTML es **un solo archivo**: no carga nada de internet, no necesita servidor y se abre con doble clic. Los únicos enlaces que salen son a los documentos oficiales citados.

Cuatro etapas —Resumen, Señales, Mercado y Auditoría— con navegación hacia adelante y atrás; lo que abriste o filtraste sigue igual al volver. En **Señales**, elegir una fuente o mover el rango de años filtra a la vez las barras, la línea de tiempo y la evidencia, así que nunca hay dos cifras que se contradigan. **"Ver todo"** despliega las cuatro en una página para buscar con `Ctrl+F`; **"Descargar PDF"** da un resumen ejecutivo de dos páginas; **"Compartir"** abre WhatsApp con cifras públicas, nunca el RFC.

Accesible por teclado y con `prefers-reduced-motion` respetado.

### Que nadie pueda alterar tu reporte

Cada reporte lleva un **folio de verificación** impreso dentro —en la sección de auditoría y en el PDF— que identifica su contenido:

```
Folio de verificación
684B8DA1-A106E655-335AC2CB-C92CBD2E
```

Y junto a los archivos se guarda `creva-sello.json` con la huella digital de cada uno. Si alguien cambia **un solo byte** —una cifra, una fecha, un "Sin sello" convertido en "Verificado"— la huella deja de coincidir y se nota.

Quien reciba el reporte puede comprobarlo sin pedirte nada:

```bash
node dist/cli/verify-report.js "<carpeta del reporte>"
```

Responde archivo por archivo: **sin cambios**, **alterado** o **no está**. Y termina con código de salida distinto de cero cuando algo no cuadra, para que se pueda revisar de forma automática.

### La firma, que es lo que acredita el origen

Un sello por sí solo comprueba integridad, no autoría: quien rehiciera el documento podría volver a sellarlo. Por eso el reporte se **firma** con una llave que solo Creva tiene.

```bash
npm run keygen
```

Genera el par, guarda la privada con permisos restringidos —**nunca se imprime en pantalla**— y te da la pública para publicar. Quien verifica la pone en su `.env`:

```
CREVA_SIGNING_PUBLIC_KEY_FILE=creva-signing.key.pub
```

La verificación distingue cinco casos y no los mezcla: **válida**, **no válida**, **falta** (se esperaba firma y no está), **sin firmar** (y nada indica que debiera llevarla) y **no se pudo comprobar** (no hay llave de confianza).

⚠️ **La llave pública de confianza se lee de tu configuración, jamás del documento que estás revisando.** Si se leyera del archivo, un falsificador solo tendría que incluir su propia llave junto a su propia firma.

⚠️ **Lo que la firma todavía no hace:** no acredita la fecha ante un tercero —la afirma quien firma—, y no sustituye una firma electrónica avanzada ni una constancia NOM-151.

### Usarlo desde un agente (MCP)

Expone sus composiciones como herramientas MCP por stdio:

| Herramienta | Qué devuelve |
|---|---|
| `creva_report` | El reporte completo: todas las señales con su fuente y su fecha, más la ficha de qué **no** estima. Guarda **los dos archivos** —la página interactiva y el PDF— en Descargas y devuelve dónde quedaron. Con `document: false` responde solo con los datos |
| `creva_verify_business` | Solo el sello del directorio |
| `creva_regulatory_radar` | Solo las reglas y novedades |
| `creva_score_disclosure` | Solo la ficha de declaración |
| `creva_verify_document` | Comprueba que los archivos de una carpeta de reporte no fueron alterados |

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

**Pedir el reporte** — los archivos vienen por defecto, no hay que pedirlos aparte:

```bash
node dist/cli/mcp-probe.js --tool creva_report --args (ConvertTo-Json @{ business_name = 'ABARROTES ERENDIRA'; state_code = 8 } -Compress)
```

Escribe la página interactiva y el PDF de dos páginas en `Descargas/Creva_Score_<negocio>_<fecha y hora>`, y devuelve la carpeta más un `resource_link` por archivo. Imprime con el Chromium que ya esté instalado —Edge o Chrome, sin dependencias nuevas—; **si no hay navegador, entrega el reporte interactivo solo** y lo dice. Con `document: false` responde únicamente con los datos, y con `embed: true` adjunta además el binario en la respuesta; eso último pesa mucho, así que va apagado por defecto.

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
