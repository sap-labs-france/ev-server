FROM mongo

MAINTAINER Serge FABIANO serge.fabiano@sap.com

RUN apt-get -y update
RUN apt-get install unzip
RUN apt-get install sudo
RUN apt-get install nano
RUN apt-get install dos2unix

ADD mongo-export.sh /mongo-export.sh
ADD mongo-import.sh /mongo-import.sh
ADD unzip_db.sh /unzip_db.sh
RUN dos2unix /mongo-export.sh
RUN dos2unix /mongo-import.sh
RUN dos2unix /unzip_db.sh

ADD export.zip /export.zip

ENV MONGO_URI=""
