# Same major/patch as the previous compose pin, plus pgvector .so for case-memory ANN.
# Keep Alpine so existing pgdata volume stays compatible (musl/glibc switch is unsafe).
FROM postgres:16-alpine@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777

RUN apk add --no-cache --virtual .build-deps \
      git \
      build-base \
  && git clone --depth 1 --branch v0.8.1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
  && make -C /tmp/pgvector OPTFLAGS="" with_llvm=no \
  && make -C /tmp/pgvector install with_llvm=no \
  && rm -rf /tmp/pgvector \
  && apk del .build-deps
