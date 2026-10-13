# Balloon Expert: interpretación local y auditoría

Esta rama conserva el editor y añade **IA Balloon Expert**. La web sigue siendo
estática en Vercel. Un servicio en el ordenador del usuario ejecuta Codex CLI con
su sesión de ChatGPT; no hay claves de OpenAI, cookies de ChatGPT ni credenciales
de Codex en Vercel o en el repositorio. Esta ejecución consume la cuota de Codex
incluida en la cuenta, no es uso ilimitado.

## Puesta en marcha en Windows

1. Instala las dependencias del repositorio con `npm ci` y comprueba `codex --version`.
2. Usa `codex login` para iniciar sesión **con ChatGPT**, y comprueba `codex login status`.
3. Conserva estos archivos en `E:\Coding_Projects\Balloon-Expert-Agent`:
   - `interpret-balloons.zip`, con `SKILL.md` y `references/`.
   - `ballooning_classification_visual_reference.pdf`.
   - `GDT_Visual_Reference.pdf`.
   - `Welding_Visual_Reference.pdf`.
4. Desde Balloon Studio, ejecuta `npm run agent:bridge`. Compila la app e inicia
   el servicio. La terminal muestra un
   código nuevo de conexión. Mantén el servicio abierto mientras interpretas.
5. Abre el despliegue de esta rama, carga un PDF/proyecto y crea los balloons.
6. En **IA Balloon Expert**, pega el código y pulsa **Conectar**. Si el navegador
   solicita acceso a la red local, autorízalo para este despliegue.
7. Confirma unidades y tolerancia general. Pulsa **Interpretar con agente**.
8. Al terminar, compara cada resultado con su evidencia. Acepta las interpretaciones
   correctas o guarda correcciones. Resuelve las incidencias antes de guardar la
   auditoría final. **Guardar proyecto** permite conservar también una revisión parcial.

Los contadores funcionan como filtros: todos, pendientes, incidencias y corregidos.
Las filas pendientes o con incidencias se resaltan en rojo suave, también al pasar
el cursor. Al recibir el resultado y guardar correcciones, la transcripción visual
se copia a la descripción de cada balloon del plano (las coordenadas conservan sus
campos de tabla). El ZIP y su XML conservan esta descripción. Las notas enviadas
originalmente se guardan en `project.audit.sourceNotes` para que la copia automática
no invalide la auditoría; un cambio independiente en la tarjeta sí la invalida.

El servicio escucha únicamente en `127.0.0.1:4318`. La autenticación usa un código
aleatorio por arranque; el navegador lo conserva solo en su sesión. Se rechazan
orígenes distintos de la lista permitida. Para usar otra URL de Vercel, configura
`BALLOON_ALLOWED_ORIGINS` con una lista exacta separada por comas antes de iniciar.
Los valores predeterminados incluyen el alias de `codex/agent-audit` y las vistas
previas locales en los puertos 4173 y 5173.

El servicio también sirve la app completa en `http://127.0.0.1:4318`. Puedes abrir
esa URL y usar el mismo código de conexión si el navegador integrado o la política
del navegador impiden conectar desde Vercel. Esta ruta conserva el flujo automático;
no necesita otro servidor ni un intercambio manual de archivos. En la web de Vercel,
los navegadores que lo requieren deben conceder el permiso de acceso a la red local.
[Chrome documenta este permiso](https://developer.chrome.com/blog/local-network-access).

`BALLOON_AGENT_DIR` permite otra carpeta de conocimientos; `BALLOON_CODEX_BIN`
permite indicar la ruta del ejecutable instalado. No se carga el YAML de Copilot
como configuración ejecutable: se reutilizan la skill y sus referencias originales.

Los trabajos, copias de conocimiento, eventos de Codex y ZIP se conservan en
`.balloon-agent/jobs/<jobId>/`, excluido de Git. Al reiniciar, los trabajos terminados
se pueden recuperar por ID; un trabajo interrumpido se marca como fallido y no se
reanuda ni consume cuota automáticamente. Hay como máximo un intérprete activo.

En la configuración, **Actividad del agente** muestra las fases de ejecución,
el tiempo transcurrido, las acciones de herramientas completadas y las últimas
acciones recibidas de Codex, actualizadas cada cuatro segundos. Los fallos de una
herramienta se muestran como avisos de posible reintento; el estado final depende
del trabajo completo. No muestra un porcentaje estimado, razonamiento privado,
comandos ni el contenido de sus salidas. Las fases de validación y empaquetado
proceden del servicio, y el registro completo permanece en `codex-events.log`.
Las últimas doce acciones se guardan junto al estado del trabajo.

Después de actualizar el servicio, espera a que termine cualquier trabajo activo,
pulsa **Ctrl + C** en su terminal y ejecuta otra vez `npm run agent:bridge`. Pega
el nuevo código en la app. Las versiones anteriores siguen funcionando, pero la
app pide reiniciarlas para disponer de actividad detallada.

## Contrato de intercambio

El paquete de solicitud contiene `request.json`, `project.json`, `inspection.xml`,
`source.pdf`, `crops/<id>.png` y la revisión PDF cuando exista. `request.json`
incluye un ID de trabajo, ID de proyecto, SHA-256 del documento, huella del contexto
de interpretación, ajustes de unidades/tolerancias y la asociación de cada recorte.

El intérprete debe devolver `agent-result.json`, con el esquema generado en
`result.schema.json`. Devuelve exactamente una fila por ID, en el orden recibido:

| Campo | Contenido |
| --- | --- |
| `balloonId` | ID estable de Balloon Studio; nunca el número de pantalla |
| `transcription` | Lectura visual fiel de la evidencia |
| `classification` | Familia canónica o etiqueta BASIC/REFERENCE de la skill |
| `description` | Descripción interpretada |
| `specification` | Requisito numérico según las reglas, o vacío |
| `gdtCallout` | Codificación GD&T según la skill, o vacío |
| `unit` | Unidad confirmada de la característica |
| `coordinateValue` | Valor leído de una coordenada, o vacío |
| `ruleApplied` | Reglas y referencias realmente utilizadas |
| `manualReview` | Incidencia material que requiere resolución |
| `reviewReason` | Motivo concreto; vacío cuando no hay incidencia |

La taxonomía interpretada se guarda separada del tipo elegido en el editor. Los
valores originales, geometría, posiciones, números, regiones y PNG no se reescriben.
La skill original genera Excel por defecto; esta integración pide explícitamente
JSON con un esquema aceptado y conserva sus reglas de lectura/interpretación.
No sustituye la visión directa por OCR ni fabrica porcentajes de confianza.

El servicio valida PDF, recortes, IDs, orden y cobertura antes de ensamblar el ZIP.
El navegador vuelve a comprobar que el resultado corresponde al proyecto actual.
Cambiar evidencia, clasificación inicial, número, orden, metadatos o GRID invalida
la revisión para exportación final. Mover solo un balloon conserva su interpretación.

La respuesta original queda en `project.audit.response`; las correcciones y
decisiones humanas quedan en `project.audit.reviews`, con fecha y nota opcional.
La app muestra una incidencia si la evidencia cambió. No borra la respuesta anterior.

## ZIP y exportación

El ZIP de respuesta contiene `project.json`, `source.pdf`, recortes, `request.json`,
`agent-result.json`, `audit.json`, `auditoria.csv` y `inspection.xml`. Se puede
abrir directamente como proyecto o importar sobre el proyecto correspondiente.

Al guardar en la app se conserva además su PDF anotado y las exportaciones
existentes. `inspection.xml` mantiene los balloons originales y añade `<audit>`
con interpretaciones enlazadas mediante `balloonId`. El XML y CSV usan la versión
corregida cuando existe; `agent-result.json` conserva siempre la respuesta original.
Esto define el contrato de Balloon Studio; no afirma compatibilidad con un importador
MES/QMS externo que no se haya verificado.

## Comprobaciones

`npm run check`, `npm test` y `npm run build:static` comprueban tipos, comportamientos
existentes, asociaciones, huellas, retorno ZIP, protección frente a rutas ajenas,
resultados antiguos y conservación de las correcciones humanas.

La prueba real requiere iniciar el servicio, interpretar un recorte con Codex,
revisarlo en la pestaña de auditoría, guardar el ZIP y volverlo a abrir.

Referencias oficiales: [autenticación de Codex con ChatGPT](https://learn.chatgpt.com/docs/auth)
y [ejecución desde scripts](https://learn.chatgpt.com/docs/non-interactive-mode).
