# CONFLICTOS — CrewReady

Los conflictos 1 a 11 son los ya listados en el encargo; se aplican con la resolución propuesta allí.
Abajo, los que aparecieron al leer los archivos y auditar los prototipos (14-nov, 20:40 CLT).

| N.º | Conflicto | Fuentes | Propuesta | ¿Bloquea? |
|---|---|---|---|---|
| 12 | El prototipo viene como bundle minificado (esbuild, sin fuentes). «Portar los juegos a componentes React» no es viable desde código minificado. | Encargo vs `CrewReady.html` | Si existe el repositorio fuente, enviarlo. Si no: embeber el prototipo tal cual en `/legacy` y reescribir en React solo PVT-B. | Sí, define M3 |
| 13 | Muse: el encargo pide Web Bluetooth; el prototipo ya usa un puente local por WebSocket (`ws://localhost:8765`). | Encargo vs prototipo | Conservar el puente del prototipo (queda en `/legacy`); no implementar Web Bluetooth. En la app nueva, Muse siempre simulado. | No |
| 14 | Control PS4: el encargo dice Gamepad API; el prototipo usa WebHID (solo Chrome/Edge) con Gamepad como respaldo. | Encargo vs prototipo | Conservar ambos dentro de `/legacy`. Demo en Chrome. | No |
| 15 | Offline (RNF-01) vs el prototipo, que descarga modelos MediaPipe y fuentes desde CDN. | RNF-01 vs prototipo | La app nueva no depende de CDN (fuentes auto-alojadas). `/legacy` sin red pierde cámara; se documenta como limitación. | No |
| 16 | Veredicto del prototipo: apto / precaución / no apto (go / caution / no-go). Informe: en rango / vigilar / consultar. | Prototipo vs informe y RF-12 | App nueva usa en rango / vigilar / consultar. `/legacy` queda con sus textos y se presenta como «chequeo de aptitud» (RF-11). | No |
| 17 | Duración: ORA en el prototipo dice «unos ocho minutos»; el pitch dice 4 minutos; RNF-10 dice 4 a 6. | Prototipo vs RNF-10 | El chequeo diario nuevo (registro + PVT-B + 1 rotativa) apunta a 4–6 min. | No |
| 18 | Tipografía: prototipo usa Rajdhani y Share Tech Mono; el diseño (d) pide Inter y Space Grotesk. | Prototipo vs diseño | App nueva sigue el diseño; `/legacy` no se retoca. | No |
| 19 | Idioma por defecto: prototipo arranca en español; el encargo pide inglés por defecto. | Prototipo vs encargo | App nueva en inglés por defecto con conmutador ES/EN. | No |
| 20 | ASTRA-MED trae umbrales clínicos sin fuente (p. ej. pulso 50–80 lpm, HRV < 40 ms, presión 95–130 mmHg). | ASTRA-MED vs RNF-09 | Reutilizar sus textos de contramedidas para la guía; sus umbrales solo entran si se respaldan con fuente, y siempre con la marca «validar con especialista». | No |
| 21 | El Excel no incluye RF-35 (asistente de voz). | Encargo vs archivo c | Registrado en TRACEABILITY.md; el Excel se actualiza en M6 si queda tiempo. | No |
| 22 | El alcance completo de pruebas (integración contra Supabase real, 9 flujos e2e, Lighthouse) no cabe en ~16 h junto con las Capas 1 y 2. | Encargo vs reloj | Priorizar unitarias completas + e2e de los flujos a, c, f, h, i con video; integración con cliente simulado + una verificación real de RLS. Lo no probado se declara en REPORTE_FINAL.md. | Confirmar |
