# File server on Raspberry Pi 4B

- Visit https://willing-just-penguin.ngrok-free.app/ to upload files to the Raspberry Pi–based remote storage.

## Host on your Raspberry Pi using Docker
> [!NOTE]
> Build and run container

- sudo docker build -t file-server .
- docker run -d -p 8080:8080 -v /home/data:/app/data file-server 

> [!NOTE]
> Stop the container

- sudo docker stop <container_id>

> [!NOTE]  
> You can expose the file server to the internet using [ngrok](https://ngrok.com/ "ngrok site").

Add `run.sh` to crontab  
- @reboot /bin/bash <path_to>/run.sh