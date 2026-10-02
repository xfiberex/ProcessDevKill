# 🚀 Roadmap: ProcessDevKill

> Responde a **qué falta por hacer**. Lo abierto está aquí entero, con su criterio de aceptación;
> lo cerrado, en una línea por Tier y con su detalle en [docs/TIERS-1-11.md](docs/TIERS-1-11.md) y
> [docs/TIER-12.md](docs/TIER-12.md).
> Por qué se decidió cada cosa, en [CONTEXT §4](CONTEXT.md); qué trajo cada versión, en el
> [CHANGELOG](CHANGELOG.md).
>
> Los checkboxes se marcan `[x]` **solo con la funcionalidad probada**. Si se probó a medias, la
> tarea dice qué quedó fuera.

## Lo hecho

| Tier | Qué trajo | Versión |
|---|---|---|
| 1 | **MVP**: la lista de procesos de desarrollo y el Kill | hasta la v1.1.1 |
| 2 | UX/UI y reactividad: eventos desde Rust, filtros, animaciones | hasta la v1.1.1 |
| 3 | **El puerto de cada proceso**, la bandeja, el atajo global y el historial | hasta la v1.1.1 |
| 4 | Uso intensivo: selección múltiple, menú contextual, rendimiento | hasta la v1.1.1 |
| 5 | Producto: tema, icono, Auto-Kill, Zombie Finder e instaladores | hasta la v1.1.1 |
| 6 | Proyecto publicado: licencia, README, pruebas del frontend y auto-actualización | v1.1.1 |
| 7 | Deuda técnica tras la primera revisión, y la documentación compactada | v1.2.0 |
| 8 | El medidor del entorno en el sidebar | v1.3.0 |
| 9 | La actualización, en silencio (`/S /UPDATE /R`) | v1.3.1 |
| 10 | **Servicios de desarrollo**: ver, arrancar, detener y cambiar el arranque, con deshacer | v1.5.0 |
| 11 | Auditoría de UX/UI: riesgo, accesibilidad, maquetación, consistencia, pulido y modo administrador | v1.6.0 a v1.8.0 |
| 12 | [Re-auditoría completa](docs/TIER-12.md): 39 tareas de seguridad, código, arquitectura, pruebas, DevOps, legal y redacción | v1.8.1 a v1.9.1 |
| — | [Revisión del 2026-08-18](docs/REVISION-2026-08-18.md): 37 tareas, cerradas | v1.3.2 a v1.5.0 |

---

## Nada abierto

**No hay ningún Tier abierto.** El Tier 12 se cerró el 2026-10-02 con la v1.9.1, y su detalle
está en [docs/TIER-12.md](docs/TIER-12.md). El siguiente trabajo, cuando lo haya, entra aquí como
Tier 13, con su criterio de aceptación.

### Lo que queda suelto

Cosas que el Tier 12 dejó dichas y sin hacer. No son un Tier: son lo que conviene saber antes de
abrir el siguiente.

- **La revisión legal de `THIRD-PARTY-NOTICES.txt` no se ha hecho** (T12-30). El archivo
  reproduce lo que se podía reproducir y dice lo que no. Por dónde empezaría: el cargador de
  WebView2 de Microsoft, enlazado en el binario y sin su licencia reproducida, y los 13
  componentes que no publican archivo de licencia. Con ella iría también si el ajuste de
  T12-31 basta en todas las jurisdicciones.
- **Una actualización de punta a punta con el instalador bloqueado** (T12-02) sigue sin verse:
  hace falta la app instalada del usuario. Tampoco se han visto en vivo el gancho de pánico
  (T12-14), un PID reciclado (T12-09), una conexión lenta de verdad (T12-17) ni el aviso de
  «protegido» cuando el guardado falla (T12-08). Los cinco tienen sus pruebas.
- **Los cuatro PR de Dependabot** abiertos el 2026-10-02 (`undici`, `hono`, `brace-expansion`,
  `ip-address`), todos de dependencias de desarrollo. Hay que pedirle que los rehaga sobre
  `main` y fusionarlos con la CI en verde.
- **`package-lock.json` dice que la app es la v1.5.3**: `release.ps1` sube la versión en
  `package.json` y no ahí. No rompe nada; se vio al leer esos PR.
- **Las pruebas con la app en marcha no están en la CI**: piden una compilación de release y un
  escritorio. Nadie ha probado si el runner lo aguanta.
- **El inglés no lo ha leído un hablante nativo** (T12-35), y las notas de cada versión siguen
  saliendo solo en español (T12-36).
- **El resumen del informe de dependencias de desarrollo** (T12-26) se genera en cada ejecución
  de la CI y nadie lo ha abierto todavía. Hoy son 10 avisos, 4 altos, ninguno en el instalador.

---

## 🔎 Revisión 2026-08-18 — cerrada

Auditoría estática del repositorio sobre la v1.3.1, en doce áreas: **37 tareas y ningún hallazgo
crítico**, cerradas las 37 el 2026-08-21. Cuatro se cerraron por decisión o por medición, no
escribiendo código: no habrá firma Authenticode (T4-02), el bundle no se divide porque no compensa
(T4-05), el rendimiento se midió (T4-03) y no había CI (T4-04, **revocada el 2026-09-23**: ver
CONTEXT §4). El detalle, en [docs/REVISION-2026-08-18.md](docs/REVISION-2026-08-18.md).

> **Los numerados se distinguen por el prefijo:** `Tier 4` es un Tier de este documento, `T4-01`
> una tarea de aquella revisión y `T12-01` una del [Tier 12](docs/TIER-12.md).
