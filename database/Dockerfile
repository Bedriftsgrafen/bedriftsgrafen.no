FROM postgres:18.3-alpine

# Patch fixable OS-level CVEs in the base image
RUN apk upgrade --no-cache

# Alpine uses musl-locales for locale support
# Norwegian locale is configured via environment variables
ENV LANG=nb_NO.UTF-8
ENV LC_ALL=nb_NO.UTF-8
