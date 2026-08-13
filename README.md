# Creva Score

**Tu negocio ya tiene historia. Aquí la puedes mostrar.**

Creva Score ayuda a las emprendedoras mexicanas a demostrar que su negocio es real y que funciona — usando registros oficiales que ya existen, para que un banco tenga algo que mirar además de un historial de crédito que todavía no tienen.

---

## El problema

Cuando una mujer abre su negocio y pide su primer crédito, el banco le pide historial. Ella no lo tiene todavía, no porque no venda, sino porque nunca le prestaron. Y como no le prestan, nunca lo construye.

Entonces le dicen que no. No por su negocio, sino por un dato que falta.

Lo injusto es que la información sí existe: su negocio está en registros públicos, su actividad está declarada, sus movimientos están en su cuenta. Nadie los junta y nadie los mira.

## ¿Qué hace Creva Score?

Reúne lo que ya se puede saber de su negocio y lo convierte en algo que se entiende y se puede enseñar:

- **Un puntaje que se explica solo.** Cada parte del puntaje dice de dónde salió y de qué fecha es. Nada de "así lo dice el sistema".
- **Información oficial, no suposiciones.** La que está publicada por las propias instituciones.
- **Cosas que sí puede hacer.** Si algo baja su puntaje, la app le dice qué cambiarlo, no solo que está mal.

## ¿Cómo lo hacemos?

Con reglas claras, no con adivinanzas:

**Nunca la castigamos por lo que no aparece.** Muchos registros oficiales son voluntarios: un negocio puede no estar ahí simplemente porque nunca se inscribió. Que no aparezca no dice nada malo de ella, así que no le resta.

**No usamos información de antecedentes penales.** Ni de ella, ni de nadie. Un puntaje de crédito no se construye con eso. Es una decisión firme y no la vamos a cambiar.

**Ella decide.** Consultamos sus datos porque ella nos lo autoriza, le decimos qué vamos a consultar y para qué, y puede pedirnos que los borremos cuando quiera.

**Que algo sea público no lo hace nuestro.** Un dato publicado por una institución sigue siendo de la persona a la que se refiere. Lo tratamos así.

## ¿Por qué México primero, y luego la región?

Empezamos en México porque ahí están nuestras usuarias. Pero la misma idea funciona en Colombia y en Perú con los registros de cada país: es el mismo producto mirando otra ventanilla. Crecer a la región no es una promesa, es el siguiente paso natural.

## Estado del proyecto

🚧 **En construcción.** Las dos piezas ya funcionan de principio a fin contra los registros oficiales reales, y su resultado se puede ver en pantalla. Todavía no hay una app que puedas abrir: eso es lo que sigue.

### 1. El sello de tu negocio

Busca tu negocio en el directorio oficial de establecimientos y, si está, emite un sello que puedes enseñar.

- **Tu puntaje no depende de esto.** Si tu negocio aparece en el directorio, ganas un sello; si no aparece, tu puntaje es exactamente el mismo. Ni mejor ni peor.
- **Lo medimos antes de decidirlo.** Revisamos cuántos micronegocios están realmente registrados y encontramos que el directorio cubre muchísimo mejor a unos estados que a otros. Si eso diera puntos, estaríamos premiando el código postal. Por eso no da puntos.
- **El sello se puede comprobar.** Dice de qué fuente salió y en qué fecha se consultó, para que cualquiera pueda verificarlo.
- **No te damos un sello que no sea tuyo.** Si buscamos y aparecen muchos negocios con nombres parecidos, te lo decimos y no emitimos nada. Un sello a nombre de otro negocio no te sirve de nada frente a un banco, y a nosotros nos costaría lo único que importa aquí: que se pueda creer.
- Si el servicio de consulta se cae, no pasa nada: tu puntaje se calcula igual.

### 2. Avisos de reglas que te afectan

Revisa lo que se publica en el diario oficial del gobierno y la lista de reglas vigentes de la autoridad bancaria, y separa lo que toca tu crédito de lo que no.

- **No consulta ningún dato tuyo.** Es la misma revisión para todas: no hay nada personal de por medio.
- **Distingue una novedad de una regla que ya existía**, para que no parezca noticia algo que lleva años publicado.
- **Cada aviso trae su fuente y su fecha**, con el documento oficial detrás.
- **Los temas que vigila salen de documentos reales**, no de palabras que nos sonaron bien: leímos el catálogo oficial completo de reglas y varios días del diario oficial, y elegimos con eso a la vista.
- Si una fuente no responde ese día, lo dice. Preferimos avisarte que no pudimos mirar, a dejarte creer que no había nada.

### Lo que guardamos, y cómo

Consultar los registros oficiales toma su tiempo, así que guardamos el resultado un rato en lugar de preguntar lo mismo una y otra vez. Dos cosas que nos importan de eso:

- **Lo guardado no lleva tu nombre en claro.** Se archiva bajo una huella ilegible, no bajo el nombre de tu negocio.
- **Se puede borrar.** Si nos pides que quitemos tus datos, hay una forma de hacerlo de verdad, no solo de dejar de mostrarlos.

Este proyecto se está construyendo durante el [IA Hackathon GovTech](https://usecroma.com/es/changelog/hackathon-govtech) (12–16 de agosto de 2026), sobre [Croma](https://usecroma.com), que da acceso a datos de gobierno de México, Colombia y Perú.

## Tus datos

Nuestro Aviso de Privacidad y nuestros Términos de Servicio están redactados y en revisión legal. Se publican aquí antes de que el producto se abra al público — no vamos a pedirte datos sin que puedas leer primero qué hacemos con ellos.

Mientras tanto, esto es lo que ya está decidido y no va a cambiar:

- Consultamos registros oficiales **solo sobre tu negocio**, y solo si tú nos autorizas.
- **No consultamos antecedentes penales** de nadie.
- No vendemos tus datos.
- Puedes ver, corregir o borrar tus datos, y retirar tu autorización, cuando quieras.

---

## Para devs

> A partir de aquí el texto es técnico. Si llegaste buscando qué hace Creva Score, ya lo leíste arriba.

**Requisitos:** Node 20 o superior.

```bash
npm install
cp .env.example .env    # y coloca tu credencial de Croma en CROMA_API_KEY
```

Sin `CROMA_API_KEY` todo arranca igual: cada consulta responde "no disponible" y nada revienta.

### Verlo funcionando

```bash
npm run demo
```

Muestra los avisos regulatorios. Para incluir el sello de un negocio:

```bash
node dist/cli/demo.js --negocio "ABARROTES ERENDIRA" --estado 8
```

En `cmd.exe`, `npm run demo -- --negocio "…"` rompe las comillas: usa `node dist/cli/demo.js` directamente.

### Verlo como producto, no como terminal

```bash
node dist/cli/demo.js --negocio "ABARROTES ERENDIRA" --estado 8 --reporte
```

Genera `creva-report.html` y `creva-report.json`. El HTML es **un solo archivo**: no carga nada de internet, no necesita servidor y se abre con doble clic. Muestra primero la investigación en curso, después las señales con su fuente y su fecha, y cierra con lo que el puntaje **no** estima.

Los únicos enlaces que salen del archivo son a los documentos oficiales citados, para que cualquiera pueda comprobarlos.

La evidencia de cada fuente viene plegada y se abre con un clic o con el teclado. Si tu sistema está configurado para reducir el movimiento, la página aparece completa y quieta, sin animaciones.

Salida real de esa corrida, recortada:

```text
Creva Score — demostración
No se consultó ninguna fuente en esta corrida: todo salió de la copia guardada.
Cada dato conserva la fecha de su consulta original.

Sello de tu negocio
-------------------
  ✔ Encontramos "ABARROTES ERENDIRA" en el directorio oficial.
  Estado: Chihuahua
  Coincidencia por nombre, sin confirmar con RFC.
  Fuente: Directorio oficial de establecimientos (SIEM) · consultado el 13 de agosto de 2026

Reglas que te afectan
---------------------
  Revisado el 13 de agosto de 2026 · 7 días de publicaciones

  Novedades publicadas: 2
  • [Novedad] Acuerdo por el que se modifican las Reglas de carácter general a que se
    refiere la Ley Federal para la Prevención e Identificación de Operaciones con
    Recursos de Procedencia Ilícita.
    Fuente: Diario Oficial de la Federación · 07 de agosto de 2026

  Reglas ya vigentes que aplican: 18
```

El estado (`--estado`) es opcional pero casi siempre necesario: buscar por nombre sin acotar suele devolver miles de coincidencias, y entonces no se emite sello.

### Usarlo desde un agente (MCP)

El proyecto expone sus composiciones como herramientas MCP por stdio: `creva_verify_business`, `creva_regulatory_radar` y `creva_score_disclosure` — esta última responde qué declara el puntaje y qué **no** estima.

```bash
npm run mcp
```

**Para probarlo sin cliente MCP**, hay una sonda que hace el saludo del protocolo y, si se lo pides, llama a una herramienta:

```bash
npm run mcp:probe
node dist/cli/mcp-probe.js --tool creva_regulatory_radar --args "{}"
```

Informa qué herramientas expone el servidor y si algo ensució el canal del protocolo:

```text
Sonda MCP

  servidor        creva-score v0.1.0
  protocolo       2025-06-18
  herramientas    creva_verify_business, creva_regulatory_radar, creva_score_disclosure
  stdout          2 líneas, solo JSON-RPC: sí
  stderr          vacío

  El canal del protocolo quedó limpio.
```

Para conectarlo a un cliente MCP:

```json
{
  "mcpServers": {
    "creva-score": {
      "command": "node",
      "args": ["dist/modules/mcp/mcp.server.js"],
      "cwd": "<ruta del repositorio>"
    }
  }
}
```

### Pruebas

```bash
npm run verify
```

Corre typecheck, lint, las tres suites y el build. Las suites se pueden correr por separado con `npm run test:unit`, `npm run test:fuzz` y `npm run test:invariant`.

Las invariantes son las que sostienen las promesas de arriba: que el sello nunca otorgue puntos, que el RFC no llegue a una llave de caché, que la credencial no salga en un registro, y que el servidor MCP no escriba en el canal del protocolo.

### Consumo de la API

La cuota base es de 100 consultas al día para toda la organización, ampliada temporalmente durante el hackathon. El diseño asume la base, no la ampliación. Verificar un negocio cuesta 2; el radar cuesta un día de gaceta por fecha revisada, más el catálogo. Los resultados se guardan en disco, así que repetir una consulta no gasta cuota.

Algunas consultas se resuelven como trabajo en segundo plano: el cliente lo detecta, espera lo que la API le indique y no da la respuesta por buena hasta que el trabajo termina. Ese sondeo no consume la cuota diaria, así que una consulta lenta cuesta lo mismo que una rápida.

## Licencia


