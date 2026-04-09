#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"
export PORT="${PORT:-8080}"

# Plantilla nginx → config final (Railway inyecta PORT)
envsubst '${PORT}' < /app/nginx.template > /etc/nginx/conf.d/default.conf

# Pantalla virtual
Xvfb "${DISPLAY}" -screen 0 1280x720x24 &
sleep 1

# Navegador (WSJ como página inicial del flujo computer-use)
chromium \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --window-size=1280,720 \
  --window-position=0,0 \
  "https://www.wsj.com" &
sleep 2

# VNC sobre el display virtual (solo loopback)
x11vnc -display "${DISPLAY}" -forever -shared -nopw -listen 127.0.0.1 -rfbport 5900 &
sleep 1

# noVNC + WebSocket hacia el VNC (puerto interno fijo)
websockify --web=/usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900 &
sleep 1

exec nginx -g "daemon off;"
