#!/bin/bash
set -euo pipefail

cd /home/aron/file-server-raspberry-pi

BUILD_ARGS=()
if [[ "${1:-}" == "--fresh" ]]; then
    BUILD_ARGS=(--no-cache --pull)
fi

/usr/bin/docker compose build "${BUILD_ARGS[@]}"

/usr/bin/docker compose up -d

/usr/bin/docker image prune -f >/dev/null

for _ in $(seq 1 30); do
    status=$(/usr/bin/docker inspect -f '{{.State.Health.Status}}' file-server 2>/dev/null || echo "starting")
    if [[ "$status" == "healthy" ]]; then
        echo "✔ file-server fut és healthy"
        exit 0
    fi
    sleep 2
done

echo "✘ file-server nem lett healthy 60 mp alatt, utolsó logok:" >&2
/usr/bin/docker compose logs --tail 50 >&2

exit 1