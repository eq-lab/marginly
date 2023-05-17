FROM node:18.14.2-alpine3.17 AS build
WORKDIR /usr/src/app
COPY . .

RUN yarn install --frozen-lockfile

WORKDIR /usr/src/app/packages/contracts
RUN yarn compile

WORKDIR /usr/src/app/packages/contracts-uniswap-mock
RUN yarn compile

WORKDIR /usr/src/app/packages/oracle
RUN yarn build

FROM node:16-slim
RUN apt-get update && apt-get install dumb-init
ENV NODE_ENV production
WORKDIR /app
RUN chown node:node .
USER node
COPY --chown=node:node --from=build ["package.json", "yarn.lock", "./"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/oracle/dist", "packages/oracle/dist/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/oracle/package.json", "/usr/src/app/packages/oracle/config.json", "./packages/oracle/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/logger/dist", "packages/logger/dist/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/logger/package.json", "./packages/logger/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/logger-node/dist", "packages/logger-node/dist/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/logger-node/package.json", "./packages/logger-node/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/common/dist", "packages/common/dist/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/common/package.json", "./packages/common/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/contracts/artifacts", "packages/contracts/artifacts/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/contracts/package.json", "./packages/contracts/"]

COPY --chown=node:node --from=build ["/usr/src/app/packages/contracts-uniswap-mock/artifacts", "packages/contracts-uniswap-mock/artifacts/"]
COPY --chown=node:node --from=build ["/usr/src/app/packages/contracts-uniswap-mock/package.json", "./packages/contracts-uniswap-mock/"]

WORKDIR /app/packages/oracle
RUN yarn install --frozen-lockfile

ENTRYPOINT ["dumb-init", "node", "dist/index.js"]