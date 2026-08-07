# File Server on Raspberry Pi 4B

A lightweight Flask-based file server running inside Docker on a Raspberry Pi 4B and exposed securely through a Cloudflare Tunnel.

**Public URL:** https://files.martonaron.dev/

---

## Features

- File upload through a web interface
- Docker-based deployment
- Cloudflare Tunnel integration (no port forwarding required)
- HTTPS enabled automatically
- Data persisted on the Raspberry Pi host

---

## Run with Docker

### Build the image

```bash
docker build -t file-server .
```

### Start the container

```bash
docker run -d \
  --name file-server \
  --restart unless-stopped \
  -p 8080:8080 \
  -v /home/data:/app/data \
  file-server
```

The application will be available locally at:

```
http://localhost:8080
```

and publicly at:

```
https://files.martonaron.dev
```

---

## Cloudflare Tunnel

The Raspberry Pi is exposed using a Cloudflare Tunnel.

Example `config.yml`:

```yaml
tunnel: <TUNNEL_ID>

credentials-file: /home/aron/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: files.martonaron.dev
    service: http://localhost:8080

  - service: http_status:404
```

Start the tunnel:

```bash
sudo systemctl start cloudflared
```

Enable it on boot:

```bash
sudo systemctl enable cloudflared
```

---

## Cleanup

### Stop the container

```bash
docker stop <container_id>
```

### Remove the container

```bash
docker rm <container_id>
```

### Remove the image

```bash
docker rmi -f <image_id>
```

### Remove the volume

```bash
docker volume rm <volume_name>
```

### Remove custom networks

```bash
docker network rm <network_name>
```

### Remove the build cache

```bash
docker builder prune -a -f
```

### Remove everything (containers, images, volumes, networks and cache)

```bash
docker system prune -a --volumes -f
```