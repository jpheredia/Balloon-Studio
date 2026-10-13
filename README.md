# Balloon Studio

Editor de planos PDF. Los documentos y proyectos se procesan en el navegador;
no requiere base de datos ni variables de entorno para funcionar.

## Balloons y coordenadas

El botón **Balloons**, junto a GRID, configura el tamaño de letra de todo el
proyecto y la esquina o el centro donde aparecerán los nuevos balloons. En las
esquinas se colocan por fuera del recorte con espacio para ver la línea de unión. El
tamaño se usa también al exportar el PDF; los balloons existentes conservan
su posición y se pueden mover manualmente.

La lista lateral ocupa el espacio inferior. Al seleccionar uno o varios
balloons, muestra los tipos y la opción de borrarlos. El borrado múltiple
requiere confirmación y se puede recuperar con Deshacer. Al borrar se compactan
los números de esa hoja; al mover, cada posición conserva su número y se
mantienen los identificadores y recortes de los balloons.

Puedes seleccionar varios con las casillas, Ctrl o Mayús y moverlos como un
bloque por arrastre, flechas o la posición de la selección. Se conserva su orden
relativo. El punto y el eje de un balloon de Coordenada se editan en la parte
superior del panel derecho; el campo Punto permite escribir nuevos nombres.

**Coordenada** permite marcar un punto y un eje; el grupo inicial contiene
Punto A/B/C y X/Y/Z. El valor queda vacío para que el agente lo determine
después a partir del recorte. No se pide en la interfaz ni se lee automáticamente
del PDF, y no bloquea guardar o exportar. Los valores de proyectos anteriores
se conservan en los datos y las exportaciones.

El ZIP incluye `coordenadas.csv`, el XML, el PDF anotado y el proyecto de formato
9. Los proyectos anteriores de tipo Tabla se convierten a Coordenada al abrirlos.

## Demo en Vercel

Importa este repositorio desde tu cuenta de Vercel. `vercel.json` configura:

- Framework: Vite.
- Instalación: `npm ci`.
- Compilación: `npm run build:static`.
- Directorio de salida: `dist/static`.

Usa la raíz del repositorio como Root Directory. Tras completar el despliegue,
Vercel proporciona una URL para compartir. Comprueba que los visitantes pueden
abrirla con la configuración de acceso elegida para la demo.

La misma carpeta `dist/static` se puede publicar en otro alojamiento estático.

## Verificación local

Requiere Node.js 22.13 o posterior.

```sh
npm ci
npm run check
npm test
npm run build:static
npm run preview:static
```

La compilación incluye el worker, las fuentes, CMaps y módulos WASM de PDF.js.
Para probarla, abre un PDF, añade una zona y exporta el resultado.

`npm run dev` y `npm run build` conservan el flujo Vinext/Sites existente.

## Interpretación con agente y auditoría

La pestaña **Auditoría / paso final** conecta con Balloon Expert mediante un
servicio local y la sesión de ChatGPT de Codex, sin claves de API. Ejecuta
`npm run agent:bridge`, pega el código que muestra la terminal y confirma las
unidades/tolerancias antes de interpretar.

El resultado conserva los recortes y los IDs originales. Puedes contrastar cada
interpretación, guardar correcciones y exportar un ZIP que se vuelve a abrir en
la app. Las decisiones humanas se guardan separadas de la respuesta del agente.

La instalación, el contrato del ZIP y la configuración de Vercel están en
[docs/agent-audit.md](docs/agent-audit.md).


