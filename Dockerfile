# The app as one container, for Azure Container Apps (docs/azure-migration-plan.md).
#
# Three stages: install, build, run. The runtime image carries only Next's
# standalone output (the server plus the slice of node_modules it imports),
# the static assets and public/, and runs as an unprivileged user on 3000.
#
# NEXT_PUBLIC_* values are compiled into the browser bundle, so they are build
# arguments here and not runtime environment. scripts/azure/deploy.sh reads
# them off the running Container App so the two cannot drift.

FROM node:22-alpine AS base
RUN npm install -g pnpm@11.9.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# HUSKY=0 skips the git hook install (`prepare`), there is no .git here.
RUN HUSKY=0 pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_HOST
ARG NEXT_PUBLIC_AUTH_COOKIE_DOMAIN
# Base64, because it is JSON with spaces and the registry build runner splits
# arguments on them. Decoded in the build step below.
ARG NEXT_PUBLIC_TEST_LOGINS_B64
ARG NEXT_PUBLIC_APP_ENV=production
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_HOST=$NEXT_PUBLIC_SITE_HOST \
    NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=$NEXT_PUBLIC_AUTH_COOKIE_DOMAIN \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    BUILD_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN NEXT_PUBLIC_TEST_LOGINS="$(printf %s "$NEXT_PUBLIC_TEST_LOGINS_B64" | base64 -d)" pnpm build

FROM node:22-alpine AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/telemetry.mjs ./telemetry.mjs
# pnpm keeps every package under node_modules/.pnpm and reaches it through a
# link. The trace carries the files the server bundle reaches, which is the
# whole telemetry package, but not the top-level link telemetry.mjs needs to
# find it by name before Next is up; so, the link.
RUN mkdir -p node_modules/@microsoft && ln -s "../.pnpm/$(ls node_modules/.pnpm | grep '^@microsoft+opentelemetry@')/node_modules/@microsoft/opentelemetry" node_modules/@microsoft/opentelemetry \
    && node --input-type=module -e "await import('@microsoft/opentelemetry')"
USER app
EXPOSE 3000
# Telemetry first, so its hooks see the server Next is about to create.
CMD ["node", "--import", "./telemetry.mjs", "server.js"]
