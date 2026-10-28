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

- Node.js 22.20 y pnpm mediante Corepack

## Instalación

```bash
cd frontend
corepack pnpm install --frozen-lockfile
```

## Variables de entorno

Crea un archivo `.env` en la carpeta `frontend/` basándote en `.env.example`:

```env
VITE_API_URL=/api
```


| Variable       | Descripción                  | Valor por defecto           |
| -------------- | ---------------------------- | --------------------------- |
| `VITE_API_URL` | La API se mantiene en el mismo origen para cookies y CSRF | `/api` (fijado por Vite) |


## Ejecución

### Desarrollo

```bash
corepack pnpm dev
```

La aplicación estará disponible en `http://localhost:5173`.

### Build de producción

```bash
corepack pnpm build
```

Los archivos generados se encuentran en `dist/`.

### Preview del build

```bash
corepack pnpm preview
```

### Linter

```bash
corepack pnpm lint
```

## Despliegue y compras

Sigue [la guía de publicación](../docs/despliegue.md). El acceso usa códigos por correo y cookies HttpOnly; los pagos se realizan únicamente al QR de Yape y se activan tras revisión manual. No hay aprobación local de compras ni claves privadas en variables `VITE_`.

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
