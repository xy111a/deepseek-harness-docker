#!/bin/bash
set -e

echo "Applying patch to unlock LAN IP logins..."
TARGET="/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/index.js"
TARGET2="/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/types/protocol.js"

for file in "$TARGET" "$TARGET2"; do
  if [ -f "$file" ]; then
    # 放宽端口和 hostname 正则匹配，支持 192.168.x.x, 10.x.x.x, 172.x.x.x 等任何有效 host
    sed -i 's/\/\^http:\\\/\\\/(?:localhost|127\\.0\\.0\\.1|\\[::1\\]):(\[0-9\]+)\\\/?\$\/i/\/^http:\\\/\\\/(?:[a-zA-Z0-9.-]+|\\[[a-fA-F0-9:]+\\]):([0-9]+)\\\/?$/i/g' "$file"
    sed -i 's/!\['\''localhost'\'', '\''127.0.0.1'\'', '\''\[::1\]'\''\].includes(url.hostname)/false/g' "$file"
    echo "Patched $file"
  fi
done
