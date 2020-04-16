FROM mongo:4.2

LABEL maintainer="Serge FABIANO <serge.fabiano@sap.com>"

RUN apt-get -y update
RUN apt-get -y install zip
RUN apt-get -y install unzip
RUN apt-get -y install sudo
RUN apt-get -y install nano
RUN apt-get -y install dos2unix
RUN apt-get -y install ftp

ADD mongo-export.sh /mongo-export.sh
RUN dos2unix /mongo-export.sh
RUN chmod 777 /mongo-export.sh

ADD zip_db.sh /zip_db.sh
RUN dos2unix /zip_db.sh
RUN chmod 777 /zip_db.sh

ENV MONGO_URI="mongodb://824190ec7c77157f355d3921f728f97f:4aa1eac3fed01d69cf624714fd84244a@10.11.138.64:27017,10.11.138.64:27017,10.11.138.64:27017/01c01768a4b24876?replicaSet=45fca33984399ad1845290ba7b69ed8d"

