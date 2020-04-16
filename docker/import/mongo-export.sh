#!/usr/bin/env bash
rm -rf export
mkdir export
mongodump --out ./export --uri=$MONGO_URI --gzip
