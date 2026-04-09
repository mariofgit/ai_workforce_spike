# browser-vm (spike)

Imagen Docker para Railway: **Chromium** en **Xvfb**, **x11vnc**, **websockify** + **noVNC**, expuesto detrás de **nginx** en **`$PORT`**.

- `GET /health` → `200 ok`
- `GET /vm-*` → redirección a `vnc_lite.html` (compatibilidad con `COMPUTER_USE_VM_VIEW_BASE_URL` + `/vm-uuid` del `EphemeralVmProvider`)

Instrucciones de deploy: [`docs/railway-browser-vm-real.md`](../../docs/railway-browser-vm-real.md).
