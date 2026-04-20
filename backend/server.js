const express = require('express');
const cors = require('cors');
const path = require('path');

// Cargar variables de entorno si existe .env.local (útil para desarrollo/pruebas)
try { 
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} catch (e) {
  // Ignorar si no existe, en producción se usarán las variables de entorno del contenedor
}

const app = express();
const PORT = process.env.PORT || 8787;

// Middlewares globales
app.use(cors());
app.use(express.json()); // Automáticamente parsea el body a JSON
app.use(express.urlencoded({ extended: true }));

// --- ENRUTAMIENTO DE LA API (Mockeando Vercel Functions) ---
// Leeremos qué pide la ruta y cargaremos el archivo de `/api` correspondiente
app.all('/api/:endpoint', async (req, res) => {
  // Ej: /api/create_user -> req.params.endpoint = 'create_user'
  const endpoint = req.params.endpoint; 
  
  try {
    const handlerPath = path.join(__dirname, '..', 'api', `${endpoint}.js`);
    
    // En desarrollo podríamos borrar caché, en prod es mejor dejarlo
    if (process.env.NODE_ENV !== 'production') {
      try { delete require.cache[require.resolve(handlerPath)]; } catch(e) {}
    }
    
    const handler = require(handlerPath);

    // Mockeamos el objeto res de Vercel/Next si el handler usa status().json() encadenado
    // (A veces Express funciona igual, pero para estar 100% seguros agregamos compatibilidad)
    const originalStatus = res.status;
    res.status = function(code) {
      originalStatus.call(this, code);
      return this; // Permite res.status(200).json(...)
    };

    await handler(req, res);

  } catch (error) {
    console.error(`[Express] Error en /api/${endpoint}:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error o Endpoint no encontrado" });
    }
  }
});

// --- SERVIDOR DE FRONTEND (React / Vite) ---
// Sirve todos los archivos estáticos de la carpeta `dist` (debe compilarse antes con npm run build)
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Cualquier otra ruta que no sea /api/ va al index.html de React (SPA fallback)
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), err => {
    if (err) {
      res.status(500).send('Archivos del frontend no encontrados. Asegurate de correr "npm run build" antes de "npm start"');
    }
  });
});

app.listen(PORT, () => {
  console.log(`[Servidor] Aplicación iniciada en http://localhost:${PORT}`);
  console.log(`[Servidor] Modo: ${process.env.NODE_ENV || 'development'}`);
});
