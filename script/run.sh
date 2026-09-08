#!/bin/bash

/usr/bin/docker run -d -p 8080:8080 -v ~/data:/app/data file-server &