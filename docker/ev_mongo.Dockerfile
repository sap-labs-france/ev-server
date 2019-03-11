FROM mongo:3.6

COPY initdb/*.js /docker-entrypoint-initdb.d/
RUN mkdir -p /home/mongodb && chown mongodb:mongodb /home/mongodb
