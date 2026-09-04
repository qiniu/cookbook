import http from 'node:http'
import crypto from 'node:crypto'

const LISTEN_HOST = '0.0.0.0'
const LISTEN_PORT = 8080
const BACKEND_HOST = '127.0.0.1'
const BACKEND_PORT = 3080
const USERNAME = process.env.DSH_WEB_USER || 'sandbox'
const PASSWORD = process.env.DSH_WEB_PASSWORD || crypto.randomBytes(24).toString('base64url')
const UPSTREAM_TOKEN = process.env.DSH_UPSTREAM_TOKEN
const COOKIE_NAME = 'dsh_gateway_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const MIN_PASSWORD_BYTES = 16
const INVALID_LOGIN_DELAY_MS = 500
const sessions = new Map()

if (!UPSTREAM_TOKEN) {
  console.error('DSH_UPSTREAM_TOKEN is required')
  process.exit(1)
}
if (Buffer.byteLength(PASSWORD, 'utf8') < MIN_PASSWORD_BYTES) {
  console.error(`DSH_WEB_PASSWORD must be at least ${MIN_PASSWORD_BYTES} bytes`)
  process.exit(1)
}

const loginPage = (message = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>DeepSeek Harness Login</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><main><h1>DeepSeek Harness</h1>${message ? `<p>${escapeHtml(message)}</p>` : ''}
<form method="post" action="/_auth/login">
<label>User <input name="username" autocomplete="username" required></label>
<label>Password <input type="password" name="password" autocomplete="current-password" required></label>
<button type="submit">Sign in</button></form></main></body></html>`

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]))
}

function safeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function parseCookies(header = '') {
  const cookies = {}
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index > 0) cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim()
  }
  return cookies
}

function authenticated(request) {
  const token = parseCookies(request.headers.cookie)[COOKIE_NAME]
  if (!token) return false
  const expiresAt = sessions.get(token)
  if (!expiresAt || expiresAt < Date.now()) {
    sessions.delete(token)
    return false
  }
  return true
}

function setSession(response) {
  const token = crypto.randomBytes(32).toString('base64url')
  sessions.set(token, Date.now() + SESSION_TTL_MS)
  response.setHeader('set-cookie', `${COOKIE_NAME}=${token}; Max-Age=${SESSION_TTL_MS / 1000}; Path=/; HttpOnly; Secure; SameSite=Strict`)
}

function upstreamHeaders(request) {
  const headers = { ...request.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` }
  if (headers.origin) headers.origin = `http://${BACKEND_HOST}:${BACKEND_PORT}`
  if (headers.referer) headers.referer = `http://${BACKEND_HOST}:${BACKEND_PORT}/`
  return headers
}

function hasUpstreamSession(request) {
  return Object.keys(parseCookies(request.headers.cookie)).some((name) => name.startsWith('dsh-auth-'))
}

function health(response) {
  const backend = http.request({ host: BACKEND_HOST, port: BACKEND_PORT, path: '/', method: 'GET', timeout: 1500 }, (upstream) => {
    upstream.resume()
    response.writeHead(upstream.statusCode && upstream.statusCode < 500 ? 200 : 503, { 'content-type': 'text/plain' })
    response.end('ok\n')
  })
  backend.on('timeout', () => backend.destroy(new Error('backend health timeout')))
  backend.on('error', () => {
    if (!response.headersSent) response.writeHead(503, { 'content-type': 'text/plain' })
    response.end('backend unavailable\n')
  })
  backend.end()
}

function proxyRequest(request, response) {
  const requestUrl = request.method === 'GET' && request.url === '/' && !hasUpstreamSession(request)
    ? `/?token=${encodeURIComponent(UPSTREAM_TOKEN)}`
    : request.url
  const upstream = http.request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    method: request.method,
    path: requestUrl,
    headers: upstreamHeaders(request),
  }, (backendResponse) => {
    response.writeHead(backendResponse.statusCode || 502, backendResponse.headers)
    backendResponse.pipe(response)
  })
  upstream.on('error', (error) => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain' })
    response.end(`backend proxy error: ${error.message}\n`)
  })
  request.pipe(upstream)
}

function parseLogin(request, response) {
  let body = ''
  request.setEncoding('utf8')
  request.on('data', (chunk) => {
    body += chunk
    if (body.length > 4096) request.destroy()
  })
  request.on('end', () => {
    const values = new URLSearchParams(body)
    const valid = safeEqual(values.get('username') || '', USERNAME) && safeEqual(values.get('password') || '', PASSWORD)
    if (!valid) {
      setTimeout(() => {
        if (response.destroyed) return
        response.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        response.end(loginPage('Invalid credentials'))
      }, INVALID_LOGIN_DELAY_MS)
      return
    }
    setSession(response)
    response.writeHead(303, { location: '/', 'cache-control': 'no-store' })
    response.end()
  })
}

const server = http.createServer((request, response) => {
  const path = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname
  if (path === '/_health' && request.method === 'GET') {
    health(response)
    return
  }
  if (path === '/_auth/login' && request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(loginPage())
    return
  }
  if (path === '/_auth/login' && request.method === 'POST') {
    parseLogin(request, response)
    return
  }
  if (!authenticated(request)) {
    response.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(loginPage('Authentication required'))
    return
  }
  proxyRequest(request, response)
})

server.on('upgrade', (request, socket, head) => {
  if (!authenticated(request)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  const upstream = http.request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    method: request.method,
    path: request.url,
    headers: upstreamHeaders(request),
  })
  upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`)
    if (upstreamHead.length) socket.write(upstreamHead)
    if (head.length) upstreamSocket.write(head)
    socket.pipe(upstreamSocket).pipe(socket)
  })
  upstream.on('response', (response) => {
    socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage || ''}\r\nConnection: close\r\n\r\n`)
    response.resume()
    socket.destroy()
  })
  upstream.on('error', () => socket.destroy())
  upstream.end()
})

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`DeepSeek Harness gateway listening on ${LISTEN_HOST}:${LISTEN_PORT}`)
})
