# Mini-VM real (PoC): Chromium en Xvfb + noVNC para login manual (p. ej. WSJ).
# Objetivo del servicio Railway: exponer HTTPS pública como COMPUTER_USE_VM_VIEW_BASE_URL.

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    dumb-init \
    gettext-base \
    nginx \
    novnc \
    procps \
    python3 \
    x11vnc \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx.template /app/nginx.template
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && mkdir -p /var/run/nginx /etc/nginx/conf.d

ENV DISPLAY=:99

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/app/entrypoint.sh"]
