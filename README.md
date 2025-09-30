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