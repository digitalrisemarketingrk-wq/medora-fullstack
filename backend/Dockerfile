FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=8000
WORKDIR /app
COPY requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock && useradd --uid 10001 --create-home medora
COPY --chown=medora:medora medora ./medora
USER medora
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn medora.app:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log --no-proxy-headers"]
