FROM debian:latest

RUN apt-get update -y
RUN apt-get upgrade -y
RUN apt-get install systemd libpam-systemd vim nano openssh-server openssh-client -y
RUN echo "/bin/bash" >> "/etc/init_exec.sh"

CMD [ "sh", "/etc/init_exec.sh" ]