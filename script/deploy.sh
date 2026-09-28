#!/bin/bash
# Usage: ./run.sh test   or   ./run.sh prod
set -euo pipefail

case "${1:-}" in
    test) ENV=test; PORT=8081; DATA=/home/aron/data ;;
    prod) ENV=prod; PORT=8080; DATA=/srv/file-server/data ;;
    *)    echo "Usage: $0 test|prod" >&2; exit 1 ;;
esac

NAME="file-server-$ENV"
IMAGE="file-server:$ENV"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
docker build -t "$IMAGE" --label "git.sha=$GIT_SHA" .

APP_UID="$(docker run --rm --entrypoint id "$IMAGE" -u)"
APP_GID="$(docker run --rm --entrypoint id "$IMAGE" -g)"

if [[ ! -d "$DATA" ]]; then
    echo "Creating $DATA (owner $APP_UID:$APP_GID)"
    sudo install -d -o "$APP_UID" -g "$APP_GID" -m 750 "$DATA"
elif [[ "$(stat -c '%u:%g' "$DATA")" != "$APP_UID:$APP_GID" ]]; then
    echo "Fixing ownership of $DATA -> $APP_UID:$APP_GID"
    sudo chown -R "$APP_UID:$APP_GID" "$DATA"
fi


docker rm -f "$NAME" 2>/dev/null || true

docker run -d \
    --name "$NAME" \
    --restart unless-stopped \
    -p "$PORT:8080" \
    --mount "type=bind,source=$DATA,target=/app/data" \
    -v /etc/os-release:/host/etc/os-release:ro \
    "$IMAGE"