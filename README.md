# Balloon Studio

Editor de planos PDF. Los documentos y proyectos se procesan en el navegador;
no requiere base de datos ni variables de entorno para funcionar.

## Balloons y coordenadas

El botón **Balloons**, junto a GRID, configura el tamaño de letra de todo el
proyecto y la esquina o el centro donde aparecerán los nuevos balloons. El
tamaño se usa también al exportar el PDF; los balloons existentes conservan
su posición y se pueden mover manualmente.

La lista lateral ocupa el espacio inferior. Al seleccionar uno o varios
balloons, muestra los tipos y la opción de borrarlos. El borrado múltiple
requiere confirmación y se puede recuperar con Deshacer.

**Coordenada** usa un grupo de puntos, un eje y un valor. El grupo inicial
contiene Punto A/B/C y X/Y/Z. La etiqueta y las exportaciones mantienen valores
como `Punto A - Coordenada X: 122,4`. El ZIP incluye `coordenadas.csv`, el XML,
el PDF anotado y el proyecto de formato 9. Los proyectos anteriores de tipo
Tabla se convierten a Coordenada al abrirlos. Las coordenadas antiguas que no
tenían valor deben completarse antes de exportar.

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


