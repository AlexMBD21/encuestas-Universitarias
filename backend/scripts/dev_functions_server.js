#!/usr/bin/env node
/*
 Minimal dev functions server to run files under /api locally.
 Usage:
  SUPABASE_SERVICE_ROLE_KEY=... node backend/scripts/dev_functions_server.js
 or set env var and run `npm run dev:functions`.
*/
const http = require('http')
const url = require('url')
const path = require('path')
// load .env.local for development (if present)
try { require('dotenv').config({ path: path.join(process.cwd(), '.env.local') }) } catch (e) {}

const port = process.env.FUNCTIONS_PORT ? parseInt(process.env.FUNCTIONS_PORT, 10) : 8787

function parseBody(req) {
  return new Promise((resolve) => {
    (async () => {
      try {
        let body = ''
        for await (const chunk of req) body += chunk
        if (body) {
          try { resolve(JSON.parse(body)) } catch (e) { resolve(body) }
        } else resolve({})
      } catch (e) { resolve({}) }
    })()
  })
}

function createWrapper(res) {
  return {
    _res: res,
    setHeader: (k, v) => { try { res.setHeader(k, v) } catch (e) {} },
    status: function(code) { try { this._res.statusCode = code } catch (e) {}; return this },
    json: function(obj) { try { this._res.setHeader('Content-Type', 'application/json') } catch (e) {}; try { this._res.end(JSON.stringify(obj)) } catch (e) {} },
    end: (d) => { try { res.end(d) } catch (e) {} }
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || '', true)
  const pathname = parsed.pathname || ''

  if (!pathname.startsWith('/api/')) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not Found' }))
    return
  }

  req.body = await parseBody(req)
  // Log incoming request for easier debugging in dev
  try { console.log('[dev functions] request:', req.method, pathname, JSON.stringify(req.body).slice(0, 1000)) } catch (e) {}

  // map /api/... to filesystem paths and try to require the handler
  const safe = pathname.replace(/^\/+/, '') // 'api/update_user'
  const candidates = [
    path.join(process.cwd(), safe),
    path.join(process.cwd(), safe + '.js'),
    path.join(__dirname, '..', safe),
    path.join(__dirname, '..', safe + '.js'),
    path.join(__dirname, '..', '..', safe),
    path.join(__dirname, '..', '..', safe + '.js')
  ]

  let handler = null
  let lastErr = null
  for (const p of candidates) {
    try {
      // try to clear cache for hot reload
      try { const resolved = require.resolve(p); if (require.cache[resolved]) delete require.cache[resolved] } catch (e) {}
      handler = require(p)
      break
    } catch (e) {
      lastErr = e
    }
  }

  if (!handler) {
    console.error('Failed to load handler for', pathname, lastErr && lastErr.message)
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not Found' }))
    return
  }

  const wrap = createWrapper(res)
  try {
    await handler(req, wrap)
  } catch (err) {
    console.error('Handler error', err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
    }
    try { res.end(JSON.stringify({ error: err && err.message ? err.message : 'server error' })) } catch (e) {}
  }
})

server.listen(port, () => {
  console.log(`Dev functions server listening on http://localhost:${port}`)
  console.log('Ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment for admin operations to work.')
  try {
    console.log('SUPABASE_SERVICE_ROLE_KEY set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    console.log('SUPABASE_URL set:', !!process.env.SUPABASE_URL)
  } catch (e) {}
})
