FROM gcc:14.2.0-bookworm

RUN rm -rf /usr/bin/apt /usr/bin/apt-get /usr/bin/dpkg /usr/bin/wget \
           /usr/bin/curl /usr/bin/git /usr/bin/perl /usr/bin/python3 \
           /usr/bin/awk /usr/bin/sed /usr/bin/find /usr/bin/xargs \
           /var/lib/apt/lists/* \
 && rm -f /bin/bash /bin/dash /bin/sh /usr/bin/bash /usr/bin/dash /usr/bin/sh

WORKDIR /sandbox

ENTRYPOINT ["/sandbox/prog"]
