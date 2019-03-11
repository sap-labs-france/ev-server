FROM mongo:3.6

COPY initdb/*.js ./docker-entrypoint-initdb.d/
COPY initdb/*.sh ./docker-entrypoint-initdb.d/
RUN mkdir -p /home/mongodb && chown mongodb:mongodb /home/mongodb
COPY initdb/export-empty-evse-db.zip ./home/mongodb
RUN chown mongodb:mongodb /home/mongodb/export-empty-evse-db.zip
RUN apt-get -y update \
    && apt-get -y install flip unzip
RUN flip -u ./docker-entrypoint-initdb.d/*.sh

