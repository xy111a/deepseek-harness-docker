import http from 'node:http';

const USER = process.env.AUTH_USER || 'huajun';
const PASS = process.env.AUTH_PASS || '0099';
const EXPECTED_AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const TARGET_PORT = 3079;
let activeToken = process.env.DSH_INTERNAL_TOKEN || '';

const server = http.createServer((req, res) => {
  // 1. Basic Auth 拦截
  const auth = req.headers['authorization'];
  if (!auth || auth !== EXPECTED_AUTH) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="DeepSeek Harness Access"',
      'Content-Type': 'text/plain; charset=utf-8'
    });
    res.end('Authentication required');
    return;
  }

  // 2. 自动带 Token 参数（首个请求）
  let targetUrl = req.url;
  const hasCookie = req.headers['cookie'] && req.headers['cookie'].includes('dsh-auth');
  if (!hasCookie && activeToken && !targetUrl.includes('token=')) {
    const separator = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${separator}token=${activeToken}`;
  }

  // 3. 始终将 Host 保持与浏览器端一致（如 192.168.88.247:3080），确保 Cookie 计算一致
  const clientHost = req.headers['host'] || '192.168.88.247:3080';
  const options = {
    hostname: '127.0.0.1',
    port: TARGET_PORT,
    path: targetUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: clientHost,
      origin: req.headers['origin'] || `http://${clientHost}`,
      'x-forwarded-host': clientHost,
      'x-forwarded-proto': 'http'
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // 拦截响应头，修正 Set-Cookie 中的 Domain 或 Path
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

  const clientHost = req.headers['host'] || '192.168.88.247:3080';
  import('node:net').then(({ connect }) => {
    const proxySocket = connect(TARGET_PORT, '127.0.0.1', () => {
      // 构造转发请求头，保留真实 host 和 origin
      const lines = [
        `${req.method} ${req.url} HTTP/1.1`,
        `Host: ${clientHost}`,
        `Origin: ${req.headers['origin'] || `http://${clientHost}`}`,
        `Upgrade: ${req.headers['upgrade'] || 'websocket'}`,
        `Connection: ${req.headers['connection'] || 'Upgrade'}`,
        `Sec-WebSocket-Key: ${req.headers['sec-websocket-key'] || ''}`,
        `Sec-WebSocket-Version: ${req.headers['sec-websocket-version'] || '13'}`,
        `Cookie: ${req.headers['cookie'] || ''}`,
        '',
        ''
      ];
      proxySocket.write(lines.join('\r\n'));
      if (head && head.length > 0) proxySocket.write(head);
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
