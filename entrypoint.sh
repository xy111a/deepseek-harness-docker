#!/bin/bash
set -e

mkdir -p "$DSH_HOME/logs"
mkdir -p /workspace

echo "=== Starting DeepSeek Harness with Basic Auth ==="
echo "DSH_HOME: $DSH_HOME"
echo "Username: ${AUTH_USER:-huajun}"

# 1. 启动 dsh 后台进程并捕获其生成的内部 Token
echo "Launching dsh runtime in background..."
dsh web --port 3079 "$@" > /tmp/dsh.log 2>&1 &
DSH_PID=$!

# 等待 Token 出现
echo "Waiting for dsh web token generation..."
TOKEN=""
for i in {1..30}; do
  if grep -q "token=" /tmp/dsh.log 2>/dev/null; then
    TOKEN=$(grep -o 'token=[^ ]*' /tmp/dsh.log | head -n 1 | cut -d= -f2)
    break
  fi
  sleep 0.5
done

if [ -n "$TOKEN" ]; then
  echo "Internal token captured successfully."
  export DSH_INTERNAL_TOKEN="$TOKEN"
else
  echo "Warning: Internal token not detected yet, proxy will rely on stored session."
fi

# 2. 启动带 HTTP Basic Auth 的反向代理
echo "Starting Node.js Basic Auth Proxy on port 3080..."
node /usr/local/bin/proxy.js &
PROXY_PID=$!

# 持续输出 dsh 日志
tail -f /tmp/dsh.log &
TAIL_PID=$!

trap "kill $DSH_PID $PROXY_PID $TAIL_PID 2>/dev/null" SIGTERM SIGINT

wait -n $DSH_PID $PROXY_PID
