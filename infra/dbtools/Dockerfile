# Postgres 17 client tools plus the migration scripts, run as a Container Apps
# job inside Azure so production data never passes through a laptop.
FROM postgres:17-alpine
COPY sql /sql
COPY migrate.sh /usr/local/bin/migrate
RUN chmod +x /usr/local/bin/migrate
USER postgres
ENTRYPOINT ["/usr/local/bin/migrate"]
