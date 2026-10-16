FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./requirements.txt
COPY backend/requirements.txt ./backend_requirements.txt

RUN pip install --no-cache-dir -r requirements.txt -r backend_requirements.txt

COPY data ./data
COPY modules ./modules
COPY backend ./backend
COPY main.py ./main.py

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
