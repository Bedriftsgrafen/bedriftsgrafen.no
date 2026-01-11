FROM postgres:15

# Generate Norwegian locale
RUN localedef -i nb_NO -c -f UTF-8 -A /usr/share/locale/locale.alias nb_NO.UTF-8

# Set default locale
ENV LANG=nb_NO.utf8
