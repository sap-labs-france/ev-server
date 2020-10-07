FROM node:lts-alpine as builder

ARG build

WORKDIR /usr/builder

COPY package.json ./

RUN npm set progress=false && npm config set depth 0 && npm cache clean --force
RUN apk add --no-cache --virtual .gyp \
  build-base \
  python \
  && npm install \
  && apk del .gyp

COPY LICENSE NOTICE ./
COPY src ./src
COPY build ./build
COPY *.json ./
COPY docker/config-standalone.json ./src/assets/config.json
COPY webpack.config.js ./

RUN npm run build:${build}

FROM node:lts-alpine

WORKDIR /usr/app
COPY --from=builder /usr/builder/node_modules ./node_modules
COPY --from=builder /usr/builder/dist ./dist

EXPOSE 80

COPY docker/autoconfig.sh /autoconfig.sh
RUN chmod +x /autoconfig.sh

RUN npm install -g pm2

#CMD /autoconfig.sh && node -r source-map-support/register --stack-trace-limit=1024 dist/start.js
CMD /autoconfig.sh && pm2-runtime dist/start.js
