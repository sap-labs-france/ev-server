FROM node:16-alpine AS builder

ARG build

WORKDIR /usr/builder

COPY package.json pnpm-lock.yaml ./
COPY LICENSE NOTICE ./
COPY src ./src
COPY types ./types
COPY build ./build
COPY *.json ./
COPY docker/config.json ./src/assets/config.json
COPY webpack.config.js ./

RUN set -ex \
  && apk add --no-cache --virtual .gyp build-base python3 git \
  && corepack enable \
  && corepack prepare pnpm@latest --activate \
  && pnpm set progress=false \
  && pnpm config set depth 0 \
  && pnpm install --ignore-scripts --frozen-lockfile \
  && pnpm build:${build} \
  && apk del .gyp

FROM node:16-alpine

ARG STACK_TRACE_LIMIT=1024
ARG MAX_OLD_SPACE_SIZE=768

ENV NODE_OPTIONS="--stack-trace-limit=${STACK_TRACE_LIMIT} --max-old-space-size=${MAX_OLD_SPACE_SIZE}"

WORKDIR /usr/app
COPY --from=builder /usr/builder/node_modules ./node_modules
COPY --from=builder /usr/builder/dist ./dist

EXPOSE 81 8000 8010 8080 9090 9292

RUN set -ex \
  && apk add --no-cache gcompat

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.7.3/wait /wait
RUN chmod +x /wait

# For Profiler
RUN npm install -g pm2 clinic autocannon

# CMD /wait && node -r source-map-support/register --stack-trace-limit=1024 dist/start.js
CMD /wait && pm2-runtime dist/start.js
