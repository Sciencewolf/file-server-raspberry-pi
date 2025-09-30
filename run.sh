#!/bin/bash

/usr/local/bin/ngrok http --domain=willing-just-penguin.ngrok-free.app 8080 &
/usr/bin/docker run -d -p 8080:8080 -v ~/data:/app/data file-server &