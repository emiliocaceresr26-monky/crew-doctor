# TRACEABILITY — CrewReady (versión inicial, sábado 14-nov 20:40 CLT)

Estado posible: `pendiente` · `parcial` · `hecho` · `recortado` · `legado` (existe solo dentro del prototipo embebido en `/legacy`, sin integrar al modelo de datos nuevo).
Nada está construido todavía: todo parte en `pendiente`. Se actualiza al cierre de cada hito.

Hitos: M0 andamiaje+deploy · M1 Capa 1 núcleo · M2 cuerpo/RIDGE/Supabase/Tierra · M3 voz ORA + PVT-B · M4 reporte/coherencia/gamificación · M5 pruebas+auditoría · M6 documentos de entrega.

## Requisitos funcionales

| ID | Nombre | Módulo | Hito | Prueba | Estado |
|---|---|---|---|---|---|
| RF-01 | 4 escenarios | `lib/scenarios`, selector | M1 | unit + e2e (a) | pendiente |
| RF-02 | Interfaz anatómica 5 nodos | `features/body-map` | M2 | e2e | pendiente |
| RF-03 | Ingreso multimodal | `features/entry` (Manual / Sensores / Visual→legado) | M1 | unit + e2e | pendiente |
| RF-04 | Motor de estimación de riesgo y alertas | `lib/alerts` | M1 | unit (umbral, z-score, bordes) + e2e (c) | pendiente |
| RF-05 | Gráficos 14 días con banda | `features/detail` (Recharts) | M1 | e2e (b) | pendiente |
| RF-06 | Guía «¿Qué significa?» | `content/guide` (local) | M1 | e2e (c) | pendiente |
| RF-07 | Gamificación | `features/progress` | M4 | unit | pendiente |
| RF-08 | Reportes JSON / PDF | `features/report` | M4 | integración + e2e (e) | pendiente |
| RF-09 | Línea base personal | `lib/baseline` | M1 | unit | pendiente |
| RF-10 | Chequeo diario con rotación | `features/checkup` | M2 | unit (rotación) | pendiente |
| RF-11 | Aptitud para tarea crítica | `/legacy` | — | manual | legado |
| RF-12 | Veredicto y 3 acciones | `lib/verdict` | M1 | unit + e2e | pendiente |
| RF-13 | Pruebas en pantalla | PVT-B nuevo (M3); resto `/legacy` | M3 | unit (mapeo) + e2e (d) | pendiente / legado |
| RF-14 | Registro diario y rápido | `features/entry` | M1 | unit + e2e | pendiente |
| RF-15 | Preguntas de seguimiento ORA | `features/ora` (reglas locales) | M3 | unit | pendiente |
| RF-16 | Evaluación psicológica | `/legacy` (DASS-21, UCLA-3); `psych_readings` + RLS | M2 (tabla) | seguridad (RLS) | legado + pendiente |
| RF-17 | Detector de coherencia | `lib/coherence` | M4 | unit | pendiente |
| RF-18 | Radiación y clima espacial | simulador + tarjeta dosis | M1 | unit | pendiente |
| RF-19 | Mapa RIDGE / HRP 15 de 17 | `features/body-map` | M2 | e2e | pendiente |
| RF-20 | Tres destinos de datos | `lib/downlink` | M2 | unit | pendiente |
| RF-21 | Retraso por entorno | `lib/downlink` (cola) | M2 | unit (cola) | pendiente |
| RF-22 | Perfil médico | `features/profile` (semilla, solo lectura) | M4 | — | pendiente |
| RF-23 | Modos Simple / Experto | `store/ui` | M1 | e2e | pendiente |
| RF-24 | Protocolo de contagio | `lib/alerts` (inmediata) | M1 | unit | pendiente |
| RF-25 | Modo demo (tecla D + botón) | `features/demo-mode` | M1 | unit + e2e (h) | pendiente |
| RF-26 | Salud ósea | `/legacy` | — | — | legado |
| RF-27 | Sensores disponibles | `SensorAdapter` simulado; real en `/legacy` | M1 | unit (is_simulated) | pendiente / legado |
| RF-28 a RF-32 | Hoja de ruta | sección «Roadmap» | M6 | — | recortado (por diseño) |
| RF-33 | Base de conocimiento catálogo | `content/catalog` (39 filas, solo lectura) | M4 si cabe | — | pendiente |
| RF-34 | Brechas del catálogo | decisión del equipo | — | — | no aplica |
| RF-35 | Asistente de voz ORA (nuevo; falta agregarlo al Excel) | `features/ora`, `/api/ora`, `/api/readings` | M3 | unit + integración + e2e (f, g) | pendiente |

## Requisitos no funcionales

| ID | Nombre | Cómo se cumple | Hito | Prueba | Estado |
|---|---|---|---|---|---|
| RNF-01 | Offline | local-first; semilla en el bundle; fuentes auto-alojadas | M1 | e2e (i) sin red | pendiente |
| RNF-02 | Usabilidad, modo oscuro | tema del diseño (d), formas + color | M1 | axe | pendiente |
| RNF-03 | < 1 s | cálculo en cliente | M5 | medición en e2e | pendiente |
| RNF-04 | Aislamiento de datos | RLS en todas las tablas | M2 | seguridad | pendiente |
| RNF-05 | Validación de entradas | `lib/validation` (zod, límites biológicos) | M1 | unit (900 lpm) + e2e | pendiente |
| RNF-06 | Responsive | móvil / tablet / escritorio | M1 | e2e en 2 viewports | pendiente |
| RNF-07 | Retraso de comunicación | cola local, alertas locales sin enlace | M2 | unit | pendiente |
| RNF-08 | Privacidad psicológica | `psych_readings` sin política pública; voz bloqueada | M2–M3 | seguridad + unit | pendiente |
| RNF-09 | Integridad científica | textos «estimación de riesgo», fuente por rango, aviso de prototipo | M1 | revisión | pendiente |
| RNF-10 | Chequeo 4–6 min | núcleo + 1 prueba rotativa | M2 | manual | pendiente |
| RNF-11 | Periféricos con degradación | adaptador simulado siempre disponible | M1 | unit | pendiente |
| RNF-12 | Calidad y trazabilidad | `source`, `is_simulated`, `excluded_from_baseline` | M1 | unit | pendiente |
| RNF-13 | Extensibilidad | parámetro = fila en `parameters` | M1 | unit (agregar fila) | pendiente |
| RNF-14 | Validación lingüística | hoja de ruta | — | — | recortado (por diseño) |

## Parámetros (66)

| N.º | Grupo | Origen | Módulo | Hito | Prueba | Estado |
|---|---|---|---|---|---|---|
| 1–25, 28–29 | Ingreso del astronauta | `app_input` | `features/entry`, semilla 14 días | M1 | validación | pendiente |
| 26–27 | DASS-21, UCLA-3 | `app_input` (psicológico) | `/legacy`; tabla `psych_readings` | M2 | RLS | legado |
| 30 | PVT-B | `app_test` | `features/tests/pvt` | M3 | mapeo source='test' | pendiente |
| 31–34 | DSST, golpeteo, Amsler, contraste | `app_test` | `/legacy`; semilla en dashboard | — | — | legado |
| 35–44 | Muse, cámara, micrófono, PS4 | `hardware` | simulado (modo demo); real en `/legacy` | M1 | is_simulated | pendiente |
| 45–46 | Temperatura, SpO₂ | `hardware` (manual) | `features/entry`, voz | M1 / M3 | alerta inmediata | pendiente |
| 47 | Fuerza de agarre | `hardware` (siempre simulada) | simulador | M1 | is_simulated | pendiente |
| 48–52, 55 | Nave, flujo continuo | `external` | `lib/simulator` | M1 | ruido + circadiano | pendiente |
| 53–54, 56–58 | Ejercicio, NOAA, DONKI | `external` (evento / 12 h) | `lib/simulator`, «Simular evento» | M1 | unit | pendiente |
| 59–60 | Línea base, veredicto | `calculated` | `lib/baseline`, `lib/verdict` | M1 | unit | pendiente |
| 61 | Pérdida ósea | `calculated` | `/legacy` | — | — | legado |
| 62–64 | Dosis vs 600 mSv, distancia, retraso | `calculated` | `lib/scenarios`, `lib/downlink` | M1–M2 | unit | pendiente |
| 65 | Estado RIDGE | `calculated` | `features/body-map` | M2 | unit | pendiente |
| 66 | Racha, XP, misiones | `calculated` | `features/progress` | M4 | unit | pendiente |
