FROM node:24-alpine AS builder

RUN apk update && apk add --no-cache \
    git \
    python3 \
    build-base \
    redis \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    pixman-dev

RUN adduser -D app
USER app

COPY --chown=app package.json package-lock.json /home/app/crafatar/
WORKDIR /home/app/crafatar
RUN npm install

COPY --chown=app . .
RUN mkdir -p images/faces images/helms images/skins images/renders images/capes

ARG VERBOSE_TEST
ARG DEBUG
RUN nohup redis-server & npm test


FROM node:24-alpine
RUN apk update && apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    pixman
RUN adduser -D app
USER app
RUN mkdir /home/app/crafatar
WORKDIR /home/app/crafatar
RUN mkdir -p images/faces images/helms images/skins images/renders images/capes

COPY --chown=app --from=builder /home/app/crafatar/node_modules/ node_modules/
COPY --chown=app package.json www.js config.js ./
COPY --chown=app lib/ lib/

VOLUME /home/app/crafatar/images
ENV NODE_ENV=production
ENTRYPOINT ["npm", "start"]
EXPOSE 3000