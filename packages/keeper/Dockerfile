FROM node:18.18.2-alpine3.18 as build
WORKDIR /usr/src/app
COPY . .

RUN yarn install --frozen-lockfile

WORKDIR /usr/src/app/packages/contracts
RUN yarn compile

WORKDIR /usr/src/app/packages/keeper
RUN yarn build

FROM node:18.18.2-slim
RUN apt-get update && apt-get install dumb-init
ENV NODE_ENV production
WORKDIR /app
RUN chown node:node .
USER node
COPY --chown=node:node ["package.json", "yarn.lock", "./"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/keeper/dist", "packages/keeper/dist/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/keeper/package.json", "./packages/keeper/"]

# Networ configs
COPY --chown=node:node --from=build ["/usr/src/app/packages/keeper/config.arbitrum-one.json", "./packages/keeper/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/keeper/config.arbitrum-goerli.json", "./packages/keeper/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/logger/dist", "packages/logger/dist/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/logger/package.json", "./packages/logger/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/logger-node/dist", "packages/logger-node/dist/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/logger-node/package.json", "./packages/logger-node/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/common/dist", "packages/common/dist/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/common/package.json", "./packages/common/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/cli-common/dist", "packages/cli-common/dist/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/cli-common/package.json", "./packages/cli-common/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/contracts/artifacts", "packages/contracts/artifacts/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/contracts/package.json", "./packages/contracts/"]

WORKDIR /app/packages/keeper
RUN yarn install --frozen-lockfile

ENTRYPOINT ["dumb-init", "node", "dist/index.js"]