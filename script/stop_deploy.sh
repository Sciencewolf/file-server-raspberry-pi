#!/bin/bash
# ./stop.sh test | prod | all
set -euo pipefail

case "${1:-}" in
    test) NAMES=(file-server-test) ;;
    prod) NAMES=(file-server-prod) ;;
    all)  NAMES=(file-server-test file-server-prod) ;;
    *)    echo "Használat: $0 test|prod|all"; exit 1 ;;
esac

DOCKER=/usr/bin/docker

for name in "${NAMES[@]}"; do
    if $DOCKER rm -f "$name" >/dev/null 2>&1; then
        echo "✔ $name leállítva és törölve"
    else
        echo "– $name nem létezett"
    fi
done

if [[ -z "$($DOCKER ps -aq --filter 'name=^file-server-')" ]]; then
    if $DOCKER rmi file-server >/dev/null 2>&1; then
        echo "✔ file-server image törölve"
    else
        echo "– file-server image nem létezett"
    fi
else
    echo "– file-server image megmarad: a másik környezet még fut"
fi

$DOCKER builder prune -af >/dev/null
$DOCKER image prune -f >/dev/null
echo "✔ build cache törölve"