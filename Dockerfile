FROM node:12

WORKDIR /usr/src/kusama-overview

ARG ENVIRONMENT
ENV ENVIRONMENT=$ENVIRONMENT

COPY . .

RUN npm ci && \
    cd api && npm ci && \
    cd ../parser-light && npm ci && \
    cd ../ui && npm ci

EXPOSE 3002 4002

ENTRYPOINT ["/bin/sh", "/usr/src/kusama-overview/docker-entrypoint.sh"]
