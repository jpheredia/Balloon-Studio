# Balloon Studio

Editor de planos PDF. Los documentos y proyectos se procesan en el navegador;
no requiere base de datos ni variables de entorno para funcionar.

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


