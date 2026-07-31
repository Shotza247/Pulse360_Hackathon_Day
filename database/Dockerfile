FROM postgres:16-alpine

LABEL maintainer="Pulse360 Team"
LABEL description="Pulse360 PostgreSQL database image"

# Copy all init scripts — executed in alphabetical order on first container start
COPY init/ /docker-entrypoint-initdb.d/

# Postgres runs on default port 5432
EXPOSE 5432
