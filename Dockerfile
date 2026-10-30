# ── 阶段 1: 编译构建 C++ 原生依赖模块 (node-pty 等) ──
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# 全局安装最新版 DeepSeek Harness 运行时
RUN npm install -g --no-audit --no-fund @deepseek-ai/dsh@latest

# ── 阶段 2: 极简生产运行环境 ──
FROM node:22-slim

# 安装运行时必需工具：网络转发工具 socat, 系统工具 curl, git, python3
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    socat \
    ca-certificates \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制已编译好的 Node 全局依赖和二进制
COPY --from=builder /usr/local/ /usr/local/

ENV DSH_HOME=/data \
    HOME=/data \
    NODE_ENV=production \
    TZ=Asia/Shanghai

WORKDIR /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD curl -f http://127.0.0.1:3080/ || exit 1

ENTRYPOINT ["entrypoint.sh"]
