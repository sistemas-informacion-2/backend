# syntax=docker/dockerfile:1

# Una sola declaracion de la version de Node para las tres etapas.
ARG NODE_IMAGE=node:24-alpine

##
# Etapa dev: servidor de Nest con recarga en caliente.
# El codigo llega por bind mount desde docker-compose.override.yml.
##
FROM ${NODE_IMAGE} AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

##
# Etapa build: instala, compila y poda en una sola pasada.
# La poda va aqui, encadenada al build, para que las devDependencies
# nunca lleguen a formar una capa propia.
# La cache de BuildKit conserva el registro de npm entre construcciones.
##
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

##
# Etapa runner: imagen final.
# Solo el runtime de Node, dist/ y las dependencias de ejecucion.
# Ni el CLI de Nest, ni Vitest, ni oxlint, ni el codigo fuente.
##
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000

# tini se encarga de ser PID 1. Sin el, Node ignora SIGTERM en esa
# posicion y "docker compose down" tarda diez segundos en matarlo.
RUN apk add --no-cache tini

# --chown evita que los archivos queden en manos de root mientras el
# proceso corre como node, usuario sin privilegios que ya trae la imagen.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# Se crea con dueno node:node ANTES del USER node para que, cuando Docker
# cree el volumen "uploads" por primera vez, siembre esos permisos en el
# volumen (solo ocurre en la primera creacion, no en montajes posteriores).
RUN mkdir -p uploads/modelos && chown -R node:node uploads

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]

# Extension explicita: el proyecto es ESM y "node dist/main" no resuelve.
CMD ["node", "dist/main.js"]
