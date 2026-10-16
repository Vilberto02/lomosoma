"""
Script lanzador para el servidor de desarrollo del Backend FastAPI.
Uso:
    python backend/run_server.py
"""

import sys
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import uvicorn

if __name__ == "__main__":
    print("\n SISTEMA INTELIGENTE LOMAS DE LIMA")
    port = int(os.environ.get("PORT", 8001))
    print(f" Servidor API:  http://127.0.0.1:{port}")
    print(f" Swagger Docs:  http://127.0.0.1:{port}/docs")
    print(f" Healthcheck:   http://127.0.0.1:{port}/api/health")
    print("\n")
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, reload=True)
