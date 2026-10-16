"""
Aplicación Principal FastAPI para el Sistema Inteligente de Lomas de Lima.
"""

import sys
import os

# Asegurar que el directorio raíz del proyecto esté en el PYTHONPATH
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.routes_lomas import router as lomas_router
from backend.app.api.routes_optimize import router as optimize_router

app = FastAPI(
    title="Sistema Inteligente de Rutas - Lomas de Lima",
    description=(
        "API RESTful para recomendación y optimización heurística de rutas turísticas "
        "en las 15 lomas costeras de Lima Metropolitana mediante Algoritmos Genéticos "
        "y Lógica Difusa Mamdani."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuración de CORS para permitir conexiones desde el Frontend (Vite / React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En desarrollo permite cualquier origen local (ej. localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de routers de la API
app.include_router(lomas_router, prefix="/api")
app.include_router(optimize_router, prefix="/api")


@app.get("/api/health", tags=["Health"])
def health_check():
    """Verificación de estado y salud del backend."""
    return {
        "status": "online",
        "service": "Sistema Inteligente Lomas de Lima API",
        "version": "1.0.0",
        "docs": "/docs"
    }
