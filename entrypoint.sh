#!/bin/bash
set -e

# 确保持久化目录存在
mkdir -p "$DSH_HOME/logs"
mkdir -p /workspace

echo "=== Starting DeepSeek Harness Container ==="
echo "DSH_HOME is set to: $DSH_HOME"
echo "Workspace is set to: /workspace"

# 启动内部端口转发：
# 官方 dsh 默认只监听 127.0.0.1:3079，通过 socat 转发暴露到 0.0.0.0:3080
echo "Setting up network bridge on port 3080 -> 127.0.0.1:3079..."
socat TCP-LISTEN:3080,fork,reuseaddr TCP:127.0.0.1:3079 &

# 启动 dsh web 运行时
echo "Launching dsh web runtime..."
exec dsh web --port 3079 "$@"
