# Railway browser VM - Step 1

## Lo único que hagas ahora en Railway

1. **Create New Service** (desde tu repo actual).
2. Nombre sugerido: `spike-browser-vm`.
3. **Root Directory**: `agents`
4. **Runtime/Builder**: Docker/Nixpacks default (dejalo auto por ahora).
5. **Start Command** (temporal, para dejarlo vivo):
   ```bash
   python -m http.server $PORT
   ```
6. Deploy.
7. En **Networking**, generá dominio público.
8. Copiame esa URL (ej. `https://spike-browser-vm-production.up.railway.app`).

Con eso yo te doy el siguiente bloque exacto (qué cambiar en env + qué endpoint vamos a conectar primero).
No toques nada más todavía.
