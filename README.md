# Tele ICU Dashboard

Aplicación React/Vite conectada a Airtable para visualizar pacientes Tele-ICU.

## Variables necesarias
Crear un archivo `.env` con:

```env
VITE_AIRTABLE_TOKEN=pat...
VITE_AIRTABLE_BASE_ID=app...
VITE_AIRTABLE_TABLE_NAME=Table 1
```

## Probar localmente
```bash
npm install
npm run dev
```

## Subir a Netlify
1. Subir este proyecto a GitHub.
2. En Netlify: Add new site > Import an existing project.
3. Elegir el repositorio.
4. Build command: `npm run build`.
5. Publish directory: `dist`.
6. En Site configuration > Environment variables, cargar las 3 variables de Airtable.
7. Deploy.

IMPORTANTE: no subir el archivo `.env` a GitHub.
