# Pinned. `:latest` would let a rebuild change the toolchain under us.
FROM gcc:14.2.0-bookworm

# Everything an attacker would otherwise find waiting for them, including the
# shell. The compiler stays; it is the point of the image.
RUN rm -rf /usr/bin/apt /usr/bin/apt-get /usr/bin/dpkg /usr/bin/wget \
           /usr/bin/curl /usr/bin/git /usr/bin/perl /usr/bin/python3 \
           /usr/bin/awk /usr/bin/sed /usr/bin/find /usr/bin/xargs \
           /var/lib/apt/lists/* \
 && rm -f /bin/bash /bin/dash /bin/sh /usr/bin/bash /usr/bin/dash /usr/bin/sh

WORKDIR /sandbox

# The runner always passes --entrypoint explicitly (the compiler, then the
# produced binary). This default exists so a mistake fails loudly rather than
# starting a shell.
ENTRYPOINT ["/sandbox/prog"]
