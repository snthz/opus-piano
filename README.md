# Piano Learn

Aplicación web progresiva (PWA), en español y de código abierto, para aprender a leer partituras
y a tocar el piano: solfeo, claves, notas, figuras, compases, armaduras y todos los símbolos
de la partitura, con ejercicios de práctica y una biblioteca de partituras personales que se
guardan **solo en tu dispositivo**.

- Funciona sin conexión una vez instalada.
- Los símbolos musicales se muestran con las fuentes originales del estándar SMuFL
  (Bravura / Bravura Text) y la notación se dibuja con VexFlow.
- No hay servidor ni cuentas: los PDF que subes se quedan en IndexedDB de tu teléfono.

## Desarrollo

Requiere Node 20+ y [bun](https://bun.sh).

```bash
bun install
bun dev          # http://localhost:3000
bun run build    # genera el sitio estático en ./out y el service worker
```

El resultado de `out/` se puede servir desde cualquier hosting estático (GitHub Pages, Netlify,
Vercel, un servidor propio…). Para instalar la PWA en el teléfono el sitio debe servirse por HTTPS.

## Plan de desarrollo

Ver [PLAN.md](./PLAN.md). Cada fase corresponde a un commit.

## Licencia

Código bajo licencia [MIT](./LICENSE). Las fuentes Bravura, Bravura Text y Academico
(Steinberg Media Technologies) se distribuyen bajo la SIL Open Font License 1.1.
