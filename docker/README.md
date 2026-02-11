# Docker Setup for Crafatar

This directory contains the Docker configuration for running Crafatar.

## Quick Start

To start Crafatar with Docker Compose:

```sh
cd docker
docker-compose up -d
```

Crafatar will be available at `http://localhost:3000`

## Services

- **crafatar**: The main application (Node.js 24)
- **redis**: Redis 7 for caching

## Stopping the Services

```sh
cd docker
docker-compose down
```

To also remove the volume:

```sh
docker-compose down -v
```

## Configuration

Environment variables can be configured in the `docker-compose.yml` file or via a `.env` file. See the main project README for available configuration options.

## Building Manually

To build the Docker image manually:

```sh
docker build -f docker/Dockerfile -t crafatar .
```

## Running Manually

If you prefer to run containers manually without docker-compose:

```sh
# Create network
docker network create crafatar

# Start Redis
docker run --net crafatar -d --name redis redis:7-alpine

# Start Crafatar
docker run --net crafatar -v crafatar-images:/home/app/crafatar/images -e REDIS_URL=redis://redis -p 3000:3000 crafatar
```
