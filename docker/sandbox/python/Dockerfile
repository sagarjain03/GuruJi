FROM python:3.12.7-slim-bookworm

# pip goes first: a sandbox that can install packages is a sandbox that fetches
# a payload the moment the network rule is ever relaxed.
RUN rm -rf /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.12 \
           /usr/local/lib/python3.12/site-packages/pip \
           /usr/local/lib/python3.12/site-packages/setuptools \
           /usr/bin/apt /usr/bin/apt-get /usr/bin/dpkg /usr/bin/wget \
           /usr/bin/curl /var/lib/apt/lists/* \
 && rm -f /bin/bash /bin/dash /bin/sh /usr/bin/bash /usr/bin/dash /usr/bin/sh

WORKDIR /sandbox

# -I isolated mode: no environment variables, no user site directory.
# -B: never try to write .pyc files, which a read-only root would refuse anyway.
ENTRYPOINT ["python3", "-I", "-B", "/sandbox/source"]
