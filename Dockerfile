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

# Tomamos las variables de Render para que Vite las pueda hornear
ARG VITE_SUPABASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL

ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Copiamos todo el resto del código
COPY . .

# Compilamos la aplicación React/Vite
RUN npm run build

# Opcional: Eliminar dependencias de desarrollo
RUN npm prune --production

# ---------------------------------------------------------

# Etapa 2: Producción
FROM node:18-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/api ./api

# Exponemos el puerto que usará nuestro servidor
EXPOSE 8787
ENV PORT=8787

# Comando para iniciar la aplicación
CMD ["npm", "start"]
