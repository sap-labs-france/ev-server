FROM mongo:4.0

MAINTAINER Serge FABIANO serge.fabiano@sap.com

RUN apt-get -y update
RUN apt-get -y install zip
RUN apt-get -y install unzip
RUN apt-get -y install sudo
RUN apt-get -y install nano
RUN apt-get -y install dos2unix
RUN apt-get -y install ftp

ADD mongo-export.sh /mongo-export.sh
ADD zip_db.sh /zip_db.sh
RUN dos2unix /mongo-export.sh
RUN dos2unix /zip_db.sh

ENV MONGO_URI="mongodb://91cca1beb2c48a58475bba02970e7b7a:506c645743ffbefd97b7deefa4a1e360@10.11.2.232:27017,10.11.2.233:27017,10.11.2.234:27017/2105035b9b1dbd42?replicaSet=6990b13aedd64c94a0b67e15dfcf3257"
ENV NEW_MONGO_URI="mongodb://7811c6934f00c65453fc599c9200d7c0:76eb06a34f70e515d415e62573a8e3fd@10.11.3.0:27017,10.11.3.1:27017,10.11.3.2:27017/692f279c23c2ea74?replicaSet=aff958bd0bf7b9ea67932ebc05216fa2"
