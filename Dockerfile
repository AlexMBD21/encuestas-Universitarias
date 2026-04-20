# Etapa 1: Construcción (Builder)
# Usamos una imagen de Node.js ligera
FROM node:18-alpine AS builder

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos primero los archivos de dependencias
# Esto ayuda a que Docker cachee las capas y no instale todo de cero si el código cambia
COPY package*.json ./

# Instalamos TODAS las dependencias (necesitamos las de desarrollo para compilar Vite)
RUN npm install

# Copiamos todo el resto del código del proyecto (respetando .dockerignore)
COPY . .

# Compilamos la aplicación React/Vite (genera la carpeta dist/)
RUN npm run build

# Opcional: Eliminar dependencias de desarrollo para aligerar la siguiente etapa
RUN npm prune --production

# ---------------------------------------------------------

# Etapa 2: Producción
FROM node:18-alpine AS runner

# Configuramos Node en modo producción
ENV NODE_ENV=production
WORKDIR /app

# Copiamos solo los archivos esenciales desde la etapa de construcción (builder)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/api ./api
COPY --from=builder /app/.env.local ./.env.local

# Exponemos el puerto que usará nuestro servidor
EXPOSE 8787
ENV PORT=8787

# Comando para iniciar la aplicación
CMD ["npm", "start"]
