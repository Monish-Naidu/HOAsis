# Postgres 17 client tools plus the migration scripts, run as a Container Apps
# job inside Azure so production data never passes through a laptop.
# Built with infra/ as the context: the SQL lives beside the Caddyfile.
FROM postgres:17-alpine
COPY supabase/sql /sql
COPY dbtools/migrate.sh /usr/local/bin/migrate
COPY dbtools/sql.sh /usr/local/bin/sql
RUN chmod +x /usr/local/bin/migrate /usr/local/bin/sql
USER postgres
ENTRYPOINT ["/usr/local/bin/migrate"]
