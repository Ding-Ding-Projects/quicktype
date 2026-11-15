# syntax=docker/dockerfile:1.7
# quicktype Studio, self-hosted web edition.
# Build from the repository root:  docker build -f studio/Dockerfile -t quicktype-studio .

ARG BUILD_IMAGE=node:22-bookworm
ARG BASE_IMAGE=node:22-bookworm-slim
# The full image already carries git, which one Git-pinned dependency needs.
FROM ${BUILD_IMAGE} AS build
WORKDIR /src
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 PUPPETEER_SKIP_DOWNLOAD=1 npm_config_fund=false npm_config_audit=false
COPY package.json package-lock.json ./
COPY packages ./packages
# An optional extra CA bundle can be supplied for builds behind a TLS-inspecting proxy:
#   docker build --secret id=extra_ca,src=/path/to/ca.pem ...
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca GIT_SSL_CAINFO=/run/secrets/extra_ca; fi; \
    git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" && \
    npm ci --ignore-scripts
RUN npm run build --workspace quicktype-core --workspace quicktype-graphql-input --workspace quicktype-typescript-input
COPY studio/package.json studio/package-lock.json ./studio/
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    cd studio && npm ci --ignore-scripts
COPY docs/studio ./docs/studio
COPY studio ./studio
ARG STUDIO_VERSION=24.0.0
ARG STUDIO_COMMIT=container
ARG STUDIO_CODENAME=
RUN cd studio && VITE_STUDIO_VERSION=$STUDIO_VERSION VITE_STUDIO_COMMIT=$STUDIO_COMMIT VITE_STUDIO_CODENAME=$STUDIO_CODENAME npx vite build
# Keep only what the server needs at runtime.
RUN npm prune --omit=dev --ignore-scripts && rm -rf packages/*/src packages/quicktype-vscode

FROM ${BASE_IMAGE}
LABEL org.opencontainers.image.title="quicktype Studio" \
      org.opencontainers.image.description="Self-hosted quicktype Studio web edition" \
      org.opencontainers.image.source="https://github.com/Ding-Ding-Projects/quicktype" \
      org.opencontainers.image.licenses="Apache-2.0"
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 STUDIO_EDITION=web
WORKDIR /app
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/packages ./packages
COPY --from=build /src/studio/package.json ./studio/package.json
COPY --from=build /src/studio/node_modules/quicktype-core ./studio/node_modules/quicktype-core
COPY --from=build /src/studio/node_modules/quicktype-graphql-input ./studio/node_modules/quicktype-graphql-input
COPY --from=build /src/studio/node_modules/quicktype-typescript-input ./studio/node_modules/quicktype-typescript-input
COPY --from=build /src/studio/server ./studio/server
COPY --from=build /src/studio/shared ./studio/shared
COPY --from=build /src/studio/dist/web ./studio/dist/web
# TypeScript input writes scratch files under the working directory.
RUN mkdir -p /app/work && chown node:node /app/work
WORKDIR /app/work
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "/app/studio/server/server.mjs"]
