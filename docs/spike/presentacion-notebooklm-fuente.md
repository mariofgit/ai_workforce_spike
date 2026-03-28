# Neuforce AI Workforce Spike — fuente para NotebookLM

Documento para subir a **Google NotebookLM** (notebooklm.google.com) como fuente única. Luego podés pedir resumen, guía de estudio, preguntas frecuentes, **Audio overview** o pedir explícitamente **diapositivas / presentación en slides** a partir de este texto.

**Instrucción sugerida para NotebookLM:** «Generá una presentación en diapositivas (título claro por slide, bullets cortos, una idea principal por slide) usando solo esta fuente. Incluí los tres agentes, el rol de NAP y las pruebas H1/H2/H3.»

---

## Diapositiva 1 — Título

**Neuforce AI Workforce Spike**  
Semanas 1–2: arquitectura híbrida NAP + **tres agentes** + evidencia

- Validar orquestación, persistencia y trazabilidad (no solo una demo de chat).
- Scope autocontenido en el repositorio `neuforce-ai-workforce-spike`.
- Entregable: sistema corriendo en local más harness de pruebas H1, H2 y H3, más un tercer agente de dominio (**Finance Analyst**) que integra con NAP sin depender del CRM.

---

## Diapositiva 2 — Problema / objetivo

**De chatbot a sistema auditable**

- Varios agentes (SDR, CRM Clerk y otros de dominio como **Finance Analyst**) necesitan un backplane común.
- Sin un **control plane (NAP)** no hay registry, inbox humano ni auditoría consistente entre servicios.
- Objetivo: demostrar el camino Neuforce v3 con interfaces claras, un ejemplo comercial (SDR + CRM) y un ejemplo **no CRM** que igual escribe en auditoría y registry.

---

## Diapositiva 3 — Arquitectura

**NAP + tres runtimes**

- **NAP** (Next.js + Prisma + Supabase): registry de agentes, bootstrap de secretos, inbox hacia humanos, eventos de auditoría, uso agregado; **consola web** con secciones colapsables (SDR, Finance, snapshot NAP, actividad CRM Clerk).
- **SDR** (FastAPI, puerto típico **8010**): primer contacto, políticas, escalación, puente hacia herramientas o MCP hacia el CRM Clerk.
- **CRM Clerk** (FastAPI, **8011**): escritura en CRM; en producción, Zoho vía Playwright u otra integración estable; expone **log de actividad** (inbound/outbound) para la UI porque no tiene un botón de demo propio.
- **Finance Analyst** (FastAPI, **8012**): **Morning shot** — consulta cotizaciones vía **Yahoo Finance** (librería `yfinance`); **no** llama al SDR ni al CRM Clerk; **sí** registra en NAP (auditoría / correlation id) y se registra en el **registry** al iniciar.

---

## Diapositiva 4 — Flujos de datos

**Dos caminos: comercial vs análisis**

- **Flujo CRM (spike principal):** evento o mensaje → **SDR** → decisión / escalación → bridge HTTP/MCP → **CRM Clerk** → acción en CRM; correlation id en **auditoría NAP** para trazar el hilo.
- **Flujo Finance (extensión demo):** usuario en consola NAP → API proxy (`/api/ui/morning-shot`) → **Finance Analyst** `/morning-shot` → datos de mercado (ej. cierre reciente, cambio %) → **post de auditoría** en NAP (`eventType` tipo `morning_shot`). Parámetros: lista de tickers (CSV); valores por defecto configurables con **`FINANCE_DEFAULT_SYMBOLS`** en `agents/.env` (ej. `NVDA,AMD,ARM`), reflejados en el input de la UI vía `/api/ui/finance-defaults`.
- Esquema de datos: tablas `nap_*` en Postgres como fuente de verdad operativa del spike.

---

## Diapositiva 5 — Finance Analyst (demo Morning shot)

**Qué muestra y por qué importa**

- Demuestra que **no todo agente es “ventas”**: mismo NAP, distinto propósito.
- Salida enriquecida para UI: **Ticker**, nombre largo del emisor, **último cierre** y **cierre previo** formateados con moneda, **variación** como porcentaje.
- Datos reales vía Yahoo cuando la red lo permite; para estabilidad del spike se evitan listas dinámicas que disparen **429** (rate limit); el script `run_spike.sh` puede ayudar a **alimentar** `FINANCE_DEFAULT_SYMBOLS` desde listas tipo `most_actives` cuando haga falta actualizar manualmente el `.env`.

---

## Diapositiva 6 — Evaluación (H1 / H2 / H3)

**Definición de hecho: pruebas reproducibles**

- **H1:** batería de mensajes sintéticos contra el **SDR**; reporte con autonomía, escalaciones y calidad aproximada.
- **H2:** múltiples escrituras al pipeline **CRM** con evidencia y consistencia.
- **H3:** flujo end-to-end feliz: cadena **SDR → CRM Clerk** con auditoría en NAP y métricas agregadas.
- **Finance Analyst:** validación manual y en consola (Morning shot + entradas de auditoría); **no reemplaza** H1–H3, que siguen acotadas al circuito comercial acordado para el spike.

---

## Diapositiva 7 — Operación y roadmap

**Qué está listo y qué sigue**

- Script **`run_spike.sh`**: NAP **3000**, SDR **8010**, CRM Clerk **8011**, Finance Analyst **8012**; logs `.nap.log`, `.sdr.log`, `.crm-clerk.log`, `.finance-analyst.log`.
- Base de datos: pooler transaccional (**6543**) para la app; **`directUrl`** / session pooler (**5432**) para Prisma cuando la red es IPv4.
- UI NAP: disparo SDR, **Morning shot** Finance, log formateado, snapshot NAP con eventos resalados, panel **CRM Clerk Activity**.
- Próximos pasos: WhatsApp real (Baileys), Zoho con selectores y MFA endurecidos, Vault o KMS para secretos, OpenTelemetry; para Finance: caches, reintentos o proveedores alternativos si Yahoo limita requests.

---

## Frase de cierre (30 segundos)

Este spike demuestra que podemos operar **varios agentes** con un backplane común (**NAP**), trazabilidad y pruebas de regresión sobre el flujo comercial (**H1–H3**), y al mismo tiempo **extender** la plataforma con un agente de **análisis financiero** que comparte registry y auditoría **sin acoplarse al CRM**. El siguiente salto es credenciales reales, automatización CRM estable y secretos y observabilidad de producción.
