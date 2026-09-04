# Plan de desarrollo — Etude

Aplicación web progresiva (PWA) personal, en español, para aprender a leer partituras y tocar el piano.
Todo funciona sin servidor: exportación estática de Next.js, datos guardados solo en el teléfono
(IndexedDB / localStorage) y uso completo sin conexión.

## Stack

| Área | Elección | Motivo |
|------|----------|--------|
| Framework | Next.js 16 (App Router, `output: "export"`) | Sitio 100 % estático, instalable en cualquier hosting |
| UI | React 19 + Tailwind CSS 4 | Rápido, móvil primero |
| Notación musical | VexFlow 5 | Renderiza pentagramas, claves, notas, compases en SVG |
| Glifos originales | Bravura / Bravura Text (SMuFL, OFL) | Son las fuentes de referencia del estándar SMuFL; los símbolos son los originales |
| PDF | pdf.js (`pdfjs-dist`) | Visor de partituras en el navegador |
| Almacenamiento | IndexedDB (`idb`) + localStorage | Los PDF nunca salen del dispositivo |
| Audio | Web Audio API | Sintetizador de piano y metrónomo sin muestras externas |
| Offline | Service worker propio + manifiesto de precache generado tras el build | Sin dependencias extra, control total |

## Fases (un commit por fase)

### Fase 0 — Base del proyecto
- Licencia MIT, plan, README.
- Configuración de exportación estática, manifest PWA, íconos, `lang="es"`.
- Layout con navegación inferior (móvil) y superior (escritorio), tema claro/oscuro.
- Fuentes Bravura / Bravura Text / Academico servidas localmente.

### Fase 1 — Motor musical
- Modelo de datos: alturas (MIDI ↔ nombre latino/anglosajón), figuras, compases, armaduras, intervalos, escalas.
- Componente `Score` (VexFlow) declarativo y componente `Glyph` (Bravura por nombre SMuFL).
- Motor de audio: sintetizador de piano, metrónomo, reproductor de secuencias.
- Catálogo de símbolos SMuFL con nombres y explicaciones en español.

### Fase 2 — Teoría I: leer el pentagrama
- Pentagrama y líneas adicionales.
- Claves (sol, fa, do) y el sistema del piano (gran pentagrama).
- Notas: nombres, octavas, alteraciones, enarmonías, ubicación en el teclado.
- Figuras y silencios, puntillo, ligadura, tresillo.

### Fase 3 — Teoría II: compases, símbolos y tonalidad
- Compases simples y compuestos, pulso, subdivisión, anacrusa, barras de compás.
- Catálogo completo de símbolos de partitura (dinámicas, articulaciones, adornos, repeticiones, tempo, pedal…).
- Armaduras y círculo de quintas, escalas mayores y menores, intervalos, acordes básicos.
- Técnica del piano: postura, digitación, lectura a dos manos.

### Fase 4 — Práctica I: reconocimiento
- Identificar notas en el pentagrama (clave de sol / fa / ambas).
- Tocar la nota en el teclado virtual.
- Flashcards de símbolos y de armaduras.
- Progreso y estadísticas guardadas localmente.

### Fase 5 — Práctica II: ritmo y solfeo
- Lectura rítmica con metrónomo y golpeo (tap) evaluado.
- Solfeo: melodías generadas por tonalidad, reproducción con audio, sílabas opcionales.
- Entrenamiento auditivo básico (intervalos).

### Fase 6 — Mis partituras
- Subir PDF e imágenes desde el teléfono a IndexedDB.
- Biblioteca con miniaturas, búsqueda, borrado y notas personales.
- Visor PDF con zoom, navegación y modo lectura.

### Fase 7 — PWA y ajustes
- Service worker con precache de todas las rutas y caché de activos.
- Página offline, aviso de instalación (iOS/Android), aviso de actualización.
- Ajustes: sistema de nombres (do-re-mi / C-D-E), sonido, borrar datos.
- Glosario A–Z.

### Fase 8 — Pulido final
- Revisión de accesibilidad y rendimiento.
- Verificación de build estático y auditoría offline.
- Documentación final.
