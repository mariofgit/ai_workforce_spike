# Railway: mini-VM real (browser + noVNC) — pasos fijos

**Repositorio GitHub:** `ai_workforce_spike`.

## Objetivo (sin ambigüedad)

Este servicio sustituye el **placeholder** de la mini-VM. Debe:

1. Exponer una **URL HTTPS pública** que el spike use como **`COMPUTER_USE_VM_VIEW_BASE_URL`** (variable del servicio **Finance** en Railway, no de este contenedor).
2. Permitir que un **humano abra en el navegador** la vista remota, vea **Chromium** y pueda hacer **login manual** (flujo WSJ / computer-use del spike).
3. Coincidir con lo que arma el código: el Finance genera enlaces **`{BASE}/vm-<uuid>`**; este gateway **redirige** esa ruta al cliente **noVNC** para que el usuario no tenga que adivinar la ruta.

**Sí necesitas Docker:** un navegador real en Linux implica paquetes del sistema (Chromium, Xvfb, VNC, noVNC). En Railway eso se despliega como **imagen Docker** (este repo ya incluye `agents/browser-vm/Dockerfile`).

---

## Pasos en Railway (en este orden)

1. **New service** → **GitHub Repo** → seleccioná **`ai_workforce_spike`**.

2. **Nombre del servicio:** `spike-browser-vm` (o el que prefieras).

3. **Settings → Source → Root Directory:**  
   **`agents/browser-vm`**  
   (carpeta donde está el `Dockerfile`; **no** uses solo `agents` ni la raíz del monorepo para este servicio).

4. **Settings → Build → Builder:**  
   **`Dockerfile`**  
   (no Railpack con `npm run build`; eso es otro proyecto).

5. **Custom Build Command:**  
   **déjalo vacío**  
   (el build es solo `docker build` usando el `Dockerfile`).

6. **Custom Start Command:**  
   **déjalo vacío**  
   (el `CMD` del `Dockerfile` ya arranca todo).

7. **Deploy** y esperá a que el build termine (la imagen es pesada: Chromium + dependencias).

8. **Settings → Networking → Generate Domain** y copiá la URL HTTPS, **sin** `/` final.  
   Ejemplo: `https://spike-browser-vm-production-xxxx.up.railway.app`

9. En el servicio **`spike-finance`** (Railway), configurá:  
   **`COMPUTER_USE_VM_VIEW_BASE_URL`** = esa URL (sin barra final).  
   **Redeploy** de Finance si hace falta para que tome la variable.

10. **Prueba:** en el navegador abrí  
    `https://<tu-host>/health`  
    → debe responder **`ok`**.  
    Luego abrí una URL con prefijo falso pero válido para el proxy, por ejemplo  
    `https://<tu-host>/vm-test-123`  
    → debe **redirigir** a noVNC; conectá y deberías ver el escritorio con **WSJ** cargado en Chromium.

---

## Límites del PoC (honestidad técnica)

- **Un contenedor = una sesión gráfica compartida.** Varios `vm-uuid` distintos hoy llevan al **mismo** Chromium (no hay aislamiento por UUID todavía). Para multi-tenant real hace falta orquestar **un contenedor o display por sesión**.
- **Memoria:** Chromium + noVNC puede exigir **512 MB–1 GB+**; si Railway reinicia el servicio, revisá límites del plan.
- **Seguridad:** VNC sin contraseña **solo en loopback** dentro del contenedor; el acceso es quien tenga la URL pública. Tratá la URL como **secreto operativo** hasta que añadan auth.

---

## Archivos en el repo

| Ruta | Rol |
|------|-----|
| [`agents/browser-vm/Dockerfile`](../agents/browser-vm/Dockerfile) | Imagen Debian + Chromium + Xvfb + x11vnc + websockify + nginx |
| [`agents/browser-vm/entrypoint.sh`](../agents/browser-vm/entrypoint.sh) | Arranque de procesos |
| [`agents/browser-vm/nginx.template`](../agents/browser-vm/nginx.template) | Puerto `$PORT`, `/health`, redirect `/vm-*` → noVNC |

---

## Paso 1 anterior (placeholder)

Si tenías solo `python -m http.server`, **dejalo de usar** para esta meta. La guía vigente para mini-VM real es **este documento**.
