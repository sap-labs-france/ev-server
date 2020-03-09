#!/usr/bin/env bash

node -r source-map-support/register --stack-trace-limit=1024 /opt/server/dist/start.js
