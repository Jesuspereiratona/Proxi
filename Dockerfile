# Imagen de la API. La web es HTML estático y no pasa por acá: va a un hosting de archivos
# (docs/07-operacion-y-mantenimiento.md).
#
# Dos etapas para que las dependencias de desarrollo (eslint, supertest) no viajen a producción.
FROM node:20-alpine AS deps
WORKDIR /app
# Solo los manifiestos primero: mientras no cambien, esta capa se reutiliza y `npm ci` no se repite
# en cada despliegue. Los workspaces obligan a copiar también los package.json de cada uno, porque
# npm los necesita para resolver el árbol antes de ver el código.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/errores/package.json packages/errores/
# --omit=dev y --workspace: la web no aporta dependencias de ejecución a la API.
RUN npm ci --omit=dev --workspace @proxi/api --include-workspace-root

FROM node:20-alpine AS runtime
WORKDIR /app
# dumb-init como PID 1: sin él, el proceso de Node ES el PID 1 y en Linux el PID 1 ignora las
# señales por defecto salvo que instale un manejador. Node instala el suyo, así que SIGTERM llega —
# pero cualquier proceso hijo huérfano quedaría zombi. Son 20 KB por un apagado ordenado que el
# despliegue usa en cada reinicio (server.js).
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
# `db/` no se copia a propósito: las migraciones las corre el flujo de despliegue
# (.github/workflows/desplegar.yml), no el contenedor. sequelize-cli es dependencia de desarrollo y
# no está en esta imagen, así que tenerlas acá sería equipaje que nadie puede usar.

# El usuario `node` ya viene en la imagen oficial. Nada acá se escribe en disco —los CV y los logos
# viven en la base desde 2026-09-20— así que el contenedor puede correr sin permiso de escritura.
USER node

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/src/server.js"]
