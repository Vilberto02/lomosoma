# Frontend — Lomosoma 

Aplicación web para planificar rutas de trekking en las lomas de Lima, utilizando un algoritmo genético multiobjetivo optimizado con lógica difusa.

## Stack Tecnológico


| Capa           | Tecnología                      |
| -------------- | ------------------------------- |
| Framework      | React 19 + TypeScript 6         |
| Bundler        | Vite 8                          |
| Estilos        | Tailwind CSS 3 + tw-animate-css |
| Mapas          | Leaflet 1.9 + react-leaflet 5   |
| Componentes UI | shadcn/ui (Radix UI y Base UI)  |
| Iconos         | lucide-react                    |
| Notificaciones | react-hot-toast                 |
| Markdown       | react-markdown y remark-gfm     |
| Linter         | oxlint                          |


## Requisitos Previos

- Node.js 20+ y npm

## Instalación

```bash
cd frontend
npm install
```

## Variables de entorno

Crea un archivo `.env` en la carpeta `frontend/` basándote en `.env.example`:

```env
VITE_API_URL=http://127.0.0.1:8001/api
```


| Variable       | Descripción                  | Valor por defecto           |
| -------------- | ---------------------------- | --------------------------- |
| `VITE_API_URL` | URL base del backend FastAPI | `http://127.0.0.1:8001/api` |


## Ejecución

### Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

### Build de producción

```bash
npm run build
```

Los archivos generados se encuentran en `dist/`.

### Preview del build

```bash
npm run preview
```

### Linter

```bash
npm run lint
```

## Estructura del proyecto

```
src/
├── components/
│   ├── Map/          # Mapa Leaflet, marcadores y controles
│   ├── Panels/       # Paneles flotantes (planificador, resultados, detalle)
│   ├── Search/       # Barra de búsqueda con autocompletado
│   └── ui/           # Componentes base (shadcn/ui)
├── services/         # Cliente HTTP para la API
├── types/            # Definiciones de tipos TypeScript
├── App.tsx           # Componente raíz y gestión de estado
└── main.tsx          # Punto de entrada
```