FROM mongo:4.2

ARG mongodb_name
ARG mongodb_user
ARG mongodb_home
ARG export_file
ENV mongodb_name=${mongodb_name}
ENV mongodb_user=${mongodb_user}
ENV mongodb_home=${mongodb_home}
ENV export_file=${export_file}

COPY initdb/*.js ./docker-entrypoint-initdb.d/
COPY initdb/*.sh ./docker-entrypoint-initdb.d/
RUN mkdir -p ${mongodb_home} && chown ${mongodb_user}:${mongodb_user} ${mongodb_home}
COPY initdb/${export_file} ${mongodb_home}
RUN chown ${mongodb_user}:${mongodb_user} ${mongodb_home}/${export_file}
RUN apt-get -y update \
  && apt-get -y install flip unzip
RUN flip -u ./docker-entrypoint-initdb.d/*.sh
