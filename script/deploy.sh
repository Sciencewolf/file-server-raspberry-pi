#!/bin/bash
# Usage: ./run.sh test   or   ./run.sh prod
set -euo pipefail

case "${1:-}" in
    test) NAME=file-server-test; PORT=8081; DATA=/home/aron/data ;;
    prod) NAME=file-server-prod; PORT=8080; DATA=/home/data ;;
    *)    echo "Usage: $0 test|prod"; exit 1 ;;
esac

cd /home/aron/file-server-raspberry-pi

/usr/bin/docker build -t file-server .

/usr/bin/docker rm -f "$NAME" 2>/dev/null || true

/usr/bin/docker run -d \
    --name "$NAME" \
    --restart unless-stopped \
    -p "$PORT:8080" \
    -v "$DATA:/app/data" \
    -v /etc/os-release:/host/etc/os-release:ro \
    file-server