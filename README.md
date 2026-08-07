# File server on Raspberry Pi 4B

- Visit https://willing-just-penguin.ngrok-free.app/ to upload files to the Raspberry Pi–based remote storage.

## Host on your Raspberry Pi using Docker
> [!NOTE]
> Build and run container

- `sudo docker build -t file-server .`
- `docker run -d -p 8080:8080 -v /home/data:/app/data file-server `

> [!CAUTION]
> Remove everything

> Stop the container
- `sudo docker stop <container_id>`
> Remove container
- `docker rm <_id>`
> Remove image
- `docker rmi -f <_id>`
> Remove volume
- `docker volume rm <_id>`
> Remove custom network
- `docker network rm <_id>`
> Remove build cache
- `docker builder prune -a -f`

> [!NOTE]  
> You can expose the file server to the internet using [ngrok](https://ngrok.com/ "ngrok site").

- Change domain inside `run.sh`
- Add `run.sh` to crontab: `@reboot /bin/bash <path_to>/run.sh`