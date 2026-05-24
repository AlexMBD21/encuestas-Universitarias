const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

// Cargar variables de entorno si existe .env.local (útil para desarrollo/pruebas)
try { 
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} catch (e) {
  // Ignorar si no existe, en producción se usarán las variables de entorno del contenedor
}

const app = express();
const PORT = process.env.PORT || 8787;

// --- CONFIGURACIÓN DE SEGURIDAD (Helmet & Cabeceras HTTP) ---
// Cabeceras configuradas automáticamente por Helmet para mitigar exploits:
// X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Content-Security-Policy, X-XSS-Protection, Referrer-Policy, Permissions-Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://*.supabase.co"], // Permitir conexión a Supabase
      imgSrc: ["'self'", "data:", "https://*.supabase.co"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// --- CONFIGURACIÓN DINÁMICA DE CORS ---
const allowedOrigins = [
  'http://localhost:5173',  // Servidor de desarrollo de Vite
  'http://localhost:8787',  // Puerto del backend local
];

if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  allowedOrigins.push(...envOrigins);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (como curl o Postman)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      return origin === allowed || origin.startsWith(allowed);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por la política CORS de EduSurvey'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Date', 'X-Api-Version']
};

app.use(cors(corsOptions));
app.use(express.json()); // Automáticamente parsea el body a JSON
app.use(express.urlencoded({ extended: true }));

// --- CONFIGURACIÓN DE RATE LIMITING ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 100, // Límite de 100 peticiones por IP por ventana
  standardHeaders: 'draft-7', // Devuelve headers RateLimit-* modernos
  legacyHeaders: false, // Deshabilita headers X-RateLimit-* heredados
  message: { error: 'Demasiadas solicitudes desde esta IP. Por favor, intenta de nuevo en 15 minutos.' }
});

app.use('/api/', apiLimiter);

// --- LISTA EXPLÍCITA DE ENDPOINTS PERMITIDOS (Mitiga Path Traversal) ---
const ALLOWED_ENDPOINTS = [
  'create_user',
  'delete_user',
  'get_inscription_survey',
  'register_project',
  'update_user'
];

// --- ENRUTAMIENTO DE LA API (Mockeando Vercel Functions) ---
app.all('/api/:endpoint', async (req, res) => {
  const endpoint = req.params.endpoint; 
  
  // Validar estrictamente contra el allowlist
  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    return res.status(404).json({ error: "Endpoint no encontrado o no permitido" });
  }
  
  try {
    const handlerPath = path.join(__dirname, '..', 'api', `${endpoint}.js`);
    
    // En desarrollo podríamos borrar caché, en prod es mejor dejarlo
    if (process.env.NODE_ENV !== 'production') {
      try { delete require.cache[require.resolve(handlerPath)]; } catch(e) {}
    }
    
    const handler = require(handlerPath);

    // Mockeamos el objeto res de Vercel/Next si el handler usa status().json() encadenado
    const originalStatus = res.status;
    res.status = function(code) {
      originalStatus.call(this, code);
      return this; // Permite res.status(200).json(...)
    };

    await handler(req, res);

  } catch (error) {
    console.error(`[Express] Error en /api/${endpoint}:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error o error al procesar la solicitud" });
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
