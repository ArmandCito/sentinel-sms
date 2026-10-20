# For Koyeb / Railway / Fly / any container host.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python manage.py collectstatic --no-input
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --no-input && gunicorn sentinel.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 30"]
