FROM node:22.11.0-bookworm-slim

# npm and npx go the same way as pip, and for the same reason.
RUN rm -rf /usr/local/bin/npm /usr/local/bin/npx /usr/local/lib/node_modules \
           /usr/bin/apt /usr/bin/apt-get /usr/bin/dpkg /usr/bin/wget \
           /usr/bin/curl /var/lib/apt/lists/* \
 && rm -f /bin/bash /bin/dash /bin/sh /usr/bin/bash /usr/bin/dash /usr/bin/sh

WORKDIR /sandbox

ENTRYPOINT ["node", "/sandbox/source"]
