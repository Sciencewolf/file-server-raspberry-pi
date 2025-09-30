FROM python:3.13-slim

WORKDIR /app

COPY . .

RUN pip install -r requirements.txt

RUN mkdir -p /app/data

EXPOSE 8080     

ENTRYPOINT [ "python", "server.py" ]

LABEL author="Márton Áron"