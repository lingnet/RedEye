FROM node:16-bullseye as redeye-builder

WORKDIR /app
COPY ./ ./
ENV CYPRESS_INSTALL_BINARY=0
RUN yarn install --immutable --inline-builds
RUN npx pkg-fetch --platform mac --node-range node16
RUN npx pkg-fetch --platform linux --node-range node16
RUN npx pkg-fetch --platform win --node-range node16
RUN yarn run release:all

FROM node:16-bullseye as redeye-linux-builder

WORKDIR /app
COPY ./ ./
ENV CYPRESS_INSTALL_BINARY=0
RUN yarn install --immutable --inline-builds
RUN npx pkg-fetch --platform linux --node-range node16
RUN yarn release:linux

### CORE IMAGE ###
FROM debian as redeye-core
WORKDIR /app
COPY --from=redeye-linux-builder /app/release/linux .
ENTRYPOINT [ "/bin/bash", "-l", "-c" ]
CMD ["./RedEye"]
