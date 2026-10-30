import http from 'node:http';

const USER = process.env.AUTH_USER || 'huajun';
const PASS = process.env.AUTH_PASS || '0099';
const EXPECTED_AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const TARGET_PORT = 3079;
let activeToken = process.env.DSH_INTERNAL_TOKEN || '';

// 注入到 HTML <head> 中的 Polyfill：修复局域网 HTTP 下缺失 crypto.randomUUID 的问题
const POLYFILL_SNIPPET = `<script>
if (!window.crypto) window.crypto = {};
if (!window.crypto.randomUUID) {
  window.crypto.randomUUID = function() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
      var arr = new Uint8Array(1);
      (window.crypto.getRandomValues || window.msCrypto.getRandomValues).call(window.crypto, arr);
      return (c ^ arr[0] & 15 >> c / 4).toString(16);
    });
  };
}
</script>`;

const server = http.createServer((req, res) => {
  // 1. Basic Auth 检查
  const auth = req.headers['authorization'];
  if (!auth || auth !== EXPECTED_AUTH) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="DeepSeek Harness Access"',
      'Content-Type': 'text/plain; charset=utf-8'
    });
    res.end('Authentication required');
    return;
  }

  // 2. 首次访问自动携带内部生成的 Token 参数
  let targetUrl = req.url;
  const hasCookie = req.headers['cookie'] && req.headers['cookie'].includes('dsh-auth');
  if (!hasCookie && activeToken && !targetUrl.includes('token=')) {
    const separator = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${separator}token=${activeToken}`;
  }

  // 3. 始终保留浏览器真实的 Host 与 Origin
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
      'x-forwarded-proto': 'http',
      // 禁止后端 gzip，以便代理层拦截并注入 Polyfill script
      ...(targetUrl === '/' || targetUrl.startsWith('/?') ? { 'accept-encoding': 'identity' } : {})
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || '';
    
    // 如果是 HTML 页面，注入 Polyfill
    if (contentType.includes('text/html')) {
      const headers = { ...proxyRes.headers };
      delete headers['content-length']; // 动态注入后长度改变，删除并使用 chunked transfer
      res.writeHead(proxyRes.statusCode, headers);

      let body = '';
      proxyRes.on('data', chunk => {
        body += chunk.toString('utf8');
      });

      proxyRes.on('end', () => {
        if (body.includes('<head>')) {
          body = body.replace('<head>', `<head>${POLYFILL_SNIPPET}`);
        } else {
          body = `${POLYFILL_SNIPPET}${body}`;
        }
        res.end(body);
      });
      return;
    }

    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Bad Gateway: ${err.message}`);
  });

  req.pipe(proxyReq, { end: true });
});

// WebSocket 支持
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
  console.log(`[Auth Proxy] Listening on 0.0.0.0:${PORT} with Basic Auth (${USER}:****) & Polyfill Injection`);
});
