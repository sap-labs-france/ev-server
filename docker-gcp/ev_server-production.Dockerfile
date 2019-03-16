FROM node:lts-alpine as builder

WORKDIR /usr/builder

COPY package.json ./package.json

RUN npm set progress=false && npm config set depth 0 && npm cache clean --force
RUN apk add --no-cache --virtual .gyp \
        build-base \
        python \
    && npm install \
    && apk del .gyp

COPY src ./src
COPY build ./build
COPY *.json ./
COPY docker/config.json ./src/assets/config.json
COPY webpack.config.js ./
RUN npm run build:prod

FROM node:lts-alpine

WORKDIR /usr/app
COPY --from=builder /usr/builder/node_modules ./node_modules
COPY --from=builder /usr/builder/dist ./dist

EXPOSE 80 81 8000 8010 8081 9090 9292

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.5.0/wait /wait
RUN chmod +x /wait

CMD /wait && node dist/start.js
