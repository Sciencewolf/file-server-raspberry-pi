#!/bin/bash

set -e

/usr/bin/docker rm -f file-server 2>/dev/null || true

cd /home/aron/file-server-raspberry-pi

/usr/bin/docker build --no-cache -t file-server .

/usr/bin/docker run -d \
    --name file-server \
    --restart unless-stopped \
    -p 8080:8080 \
    -v /home/data:/app/data \
    file-server
