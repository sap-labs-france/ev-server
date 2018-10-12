FROM mongo

MAINTAINER Serge FABIANO serge.fabiano@sap.com

RUN apt-get -y update
RUN apt-get -y install zip
RUN apt-get -y install unzip
RUN apt-get -y install sudo
RUN apt-get -y install nano
RUN apt-get -y install dos2unix
RUN apt-get -y install ftp

ADD mongo-export.sh /mongo-export.sh
ADD mongo-import.sh /mongo-import.sh
ADD unzip_db.sh /unzip_db.sh
ADD zip_db.sh /zip_db.sh
RUN dos2unix /mongo-export.sh
RUN dos2unix /mongo-import.sh
RUN dos2unix /unzip_db.sh

ADD export.zip /export.zip

ENV MONGO_URI=""
