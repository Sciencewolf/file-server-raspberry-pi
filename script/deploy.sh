#!/bin/bash
# Használat:
#   ./deploy.sh test            új build a jelenlegi kódból -> test környezet (port 8081)
#   ./deploy.sh test --fresh    ugyanez teljes újrabuilddel, friss base image-dzsel
#   ./deploy.sh prod            a már letesztelt test image élesítése (NINCS új build)
#   ./deploy.sh rollback        prod visszaállítása az előző verzióra
#   ./deploy.sh restart test|prod   csak újraindítás, build nélkül
set -euo pipefail

cd /home/aron/file-server-raspberry-pi
DOCKER=/usr/bin/docker

compose() {  # compose <env> <args...>
    local env="$1"; shift
    "$DOCKER" compose -p "file-server-$env" --env-file ".env.$env" "$@"
}

image_exists() { "$DOCKER" image inspect "$1" >/dev/null 2>&1; }

wait_healthy() {
    local name="file-server-$1"
    for _ in $(seq 1 30); do
        status=$("$DOCKER" inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || echo "starting")
        if [[ "$status" == "healthy" ]]; then
            echo "✔ $name fut és healthy"
            return 0
        fi
        sleep 2
    done
    echo "✘ $name nem lett healthy 60 mp alatt, utolsó logok:" >&2
    compose "$1" logs --tail 50 >&2
    return 1
}

case "${1:-}" in
    test)
        build_args=()
        [[ "${2:-}" == "--fresh" ]] && build_args=(--no-cache --pull)
        compose test build "${build_args[@]}"
        compose test up -d --no-build --force-recreate
        wait_healthy test
        ;;
    prod)
        image_exists file-server:test || { echo "Nincs file-server:test image, előbb: ./deploy.sh test" >&2; exit 1; }

        image_exists file-server:prod && "$DOCKER" tag file-server:prod file-server:prod-prev
        "$DOCKER" tag file-server:test file-server:prod
        compose prod up -d --no-build --force-recreate
        wait_healthy prod
        ;;
    rollback)
        image_exists file-server:prod-prev || { echo "Nincs mentett előző prod verzió" >&2; exit 1; }
        "$DOCKER" tag file-server:prod-prev file-server:prod
        compose prod up -d --no-build --force-recreate
        wait_healthy prod
        ;;
    restart)
        [[ "${2:-}" =~ ^(test|prod)$ ]] || { echo "Használat: ./deploy.sh restart test|prod" >&2; exit 2; }
        compose "$2" restart
        wait_healthy "$2"
        ;;
    *)
        sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
        exit 2
        ;;
esac

"$DOCKER" image prune -f >/dev/null