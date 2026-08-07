# File server on Raspberry Pi 4B

- Visit https://willing-just-penguin.ngrok-free.app/ to upload files to the Raspberry Pi–based remote storage.

## Host on your Raspberry Pi using Docker
> [!NOTE]
> Build and run container

- `sudo docker build -t file-server .`
- `docker run -d -p 8080:8080 -v /home/data:/app/data file-server `

> [!NOTE]
> Stop the container

- `sudo docker stop <container_id>`

> [!CAUTION]
> Remove everything

> Stop all running containers
- docker stop $(docker ps -q)
> Remove all containers
- docker rm $(docker ps -aq)
> Remove all images
- docker rmi -f $(docker images -aq)
> Remove all volumes
- docker volume rm $(docker volume ls -q)
> Remove all custom networks
- docker network rm $(docker network ls -q --filter type=custom)
> Remove build cache
- docker builder prune -a -f

> [!NOTE]  
> You can expose the file server to the internet using [ngrok](https://ngrok.com/ "ngrok site").

- Change domain inside `run.sh`
- Add `run.sh` to crontab: `@reboot /bin/bash <path_to>/run.sh`