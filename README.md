# DeepSeek Harness Docker Image

Automated build and packaging for DeepSeek's AI Agent Runtime ([@deepseek-ai/dsh](https://github.com/deepseek-ai/deepseek-harness)).

## Quick Start with Docker Compose

```yaml
services:
  deepseek-harness:
    image: ghcr.io/xy111a/deepseek-harness:latest
    container_name: deepseek-harness
    restart: unless-stopped
    ports:
      - "3080:3080"
    environment:
      - TZ=Asia/Shanghai
      - NODE_ENV=production
      - DSH_HOME=/data
      - HOME=/data
    volumes:
      - ./data:/data
      - ./workspace:/workspace
    networks:
      - services
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://127.0.0.1:3080/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "3"

networks:
  services:
    external: true
    name: services
```
