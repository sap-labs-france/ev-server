FROM node:16-alpine as builder

ARG build

WORKDIR /usr/builder

COPY package.json pnpm-lock.yaml ./
COPY LICENSE NOTICE ./
COPY src ./src
COPY types ./types
COPY build ./build
COPY *.json ./
COPY docker/config-standalone.json ./src/assets/config.json
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

EXPOSE 80

RUN set -ex \
  && apk add --no-cache gcompat

COPY docker/autoconfig.sh /autoconfig.sh
RUN chmod +x /autoconfig.sh

# For Profiler
RUN npm install -g pm2 clinic autocannon

#CMD /autoconfig.sh && node -r source-map-support/register --stack-trace-limit=1024 dist/start.js
CMD /autoconfig.sh && pm2-runtime dist/start.js
