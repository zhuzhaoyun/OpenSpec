#!/bin/sh
set -e

# 用容器运行时环境变量替换 config.js 中的占位符
# 环境变量由 docker-compose 从 .env 文件注入
sed -i \
  -e "s|__VITE_CLAWITH_BASE_URL__|${VITE_CLAWITH_BASE_URL}|g" \
  -e "s|__VITE_CLAWITH_AGENT_ID__|${VITE_CLAWITH_AGENT_ID}|g" \
  -e "s|__VITE_CLAWITH_EMAIL__|${VITE_CLAWITH_EMAIL}|g" \
  -e "s|__VITE_CLAWITH_PASSWORD__|${VITE_CLAWITH_PASSWORD}|g" \
  /usr/share/nginx/html/config.js

echo "config.js injected successfully"
exec nginx -g 'daemon off;'
