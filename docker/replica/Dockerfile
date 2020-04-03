FROM mongo:4.2

COPY script.js ./

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.7.3/wait /wait
RUN chmod +x /wait

CMD /wait && mongo admin --host ev_mongo -u evse-admin -p evse-admin-pwd script.js





