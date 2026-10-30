import http from 'node:http';

const USER = process.env.AUTH_USER || 'huajun';
const PASS = process.env.AUTH_PASS || '0099';
const EXPECTED_AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const TARGET_PORT = 3079;
let activeToken = process.env.DSH_INTERNAL_TOKEN || '';

export function setToken(token) {
  activeToken = token;
}

const server = http.createServer((req, res) => {
  // 1. 检查 Basic Auth
  const auth = req.headers['authorization'];
  if (!auth || auth !== EXPECTED_AUTH) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="DeepSeek Harness Access"',
      'Content-Type': 'text/plain; charset=utf-8'
    });
    res.end('Authentication required');
    return;
  }

  // 2. 如果请求携带了 Basic Auth，为初次请求自动注入内部认证 Token
  let targetUrl = req.url;
  const hasCookie = req.headers['cookie'] && req.headers['cookie'].includes('dsh-auth');
  if (!hasCookie && activeToken && !targetUrl.includes('token=')) {
    const separator = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${separator}token=${activeToken}`;
  }

  const options = {
    hostname: '127.0.0.1',
    port: TARGET_PORT,
    path: targetUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: '127.0.0.1:3079'
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Bad Gateway: ${err.message}`);
  });

  req.pipe(proxyReq, { end: true });
});

// 支持 WebSocket
server.on('upgrade', (req, socket, head) => {
  const auth = req.headers['authorization'];
  if (!auth || auth !== EXPECTED_AUTH) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  import('node:net').then(({ connect }) => {
    const proxySocket = connect(TARGET_PORT, '127.0.0.1', () => {
      proxySocket.write(head);
      socket.pipe(proxySocket).pipe(socket);
    });
    proxySocket.on('error', () => socket.destroy());
    socket.on('error', () => proxySocket.destroy());
  });
});

const PORT = process.env.PORT || 3080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Auth Proxy] Listening on 0.0.0.0:${PORT} with Basic Auth (${USER}:****)`);
});
