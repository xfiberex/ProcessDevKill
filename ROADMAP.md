# 🚀 Roadmap: ProcessDevKill

> Responde a **qué falta por hacer**. Lo abierto está aquí entero, con su criterio de aceptación;
> lo cerrado, en una línea por Tier y con su detalle en [docs/TIERS-1-11.md](docs/TIERS-1-11.md),
> [docs/TIER-12.md](docs/TIER-12.md) y [docs/TIER-13.md](docs/TIER-13.md).
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
| 13 | [Más runtimes y lo que el Tier 12 dejó suelto](docs/TIER-13.md): **Java, Deno y Bun** de fábrica, las notas de versión en inglés, el ajuste de los filtros y lo que nunca se había visto en marcha | v1.10.0 y v1.10.1 |
| — | [Revisión del 2026-08-18](docs/REVISION-2026-08-18.md): 37 tareas, cerradas | v1.3.2 a v1.5.0 |

---

## Nada abierto

**No hay ningún Tier abierto.** El Tier 13 se cerró el 2026-10-03 con la v1.10.1, y su detalle
está en [docs/TIER-13.md](docs/TIER-13.md). El siguiente trabajo, cuando lo haya, entra aquí como
Tier 14, con su criterio de aceptación.

### Lo que queda suelto

Cosas que los Tiers 12 y 13 dejaron dichas y sin hacer. No son un Tier: son lo que conviene saber
antes de abrir el siguiente.

- **La revisión legal de `THIRD-PARTY-NOTICES.txt` no se ha hecho** (T12-30). El archivo
  reproduce lo que se podía reproducir y dice lo que no. Por dónde empezaría: el cargador de
  WebView2 de Microsoft, enlazado en el binario y sin su licencia reproducida, y los 13
  componentes que no publican archivo de licencia. Con ella iría también si el ajuste de
  T12-31 basta en todas las jurisdicciones.
- **Los PR de Dependabot se miran y se fusionan a mano.** Los siete que abrió al encenderlo
  (`undici`, `hono`, `brace-expansion`, `ip-address`, `fast-uri`, `js-yaml` y `vitest`) se
  fusionaron el 2026-10-02. Seguirá abriendo otros: cada uno se lee, se comprueba que solo toca
  dependencias de desarrollo —o se regeneran los avisos de terceros si no— y se fusiona con la
  CI en verde. La alerta de `glib` (#36) se descartó el 2026-10-03 como «código que no se usa»:
  es un crate de Linux, no va en el binario de Windows, y su arreglo (0.20.0) no lo admite el
  `gtk` 0.18 que trae Tauri. `cargo audit` la sigue enseñando como aviso. Se vuelve a mirar en la
  próxima auditoría, o antes si la app saliera para Linux.
- **El inglés no lo ha leído un hablante nativo** (T12-35), y desde la v1.10.0 hay más: las
  notas de cada versión, en `CHANGELOG.en.md` (T13-04).
- **Seis avisos altos en las dependencias de desarrollo, todos el mismo** (T13-02): `braces`
  ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) no tiene versión
  arreglada, y llega por `shadcn`. No viaja en el instalador y solo corre cuando quien desarrolla
  lanza el CLI de `shadcn`. Se quita cuando `braces` publique el arreglo; hasta entonces sale
  en el resumen de cada ejecución de la CI.
- **Las pruebas con la app en marcha siguen fuera de la CI de cada push** (T13-03). El runner
  las aguanta, en unos 10 minutos, y se pueden lanzar a mano con `gh workflow run
  en-marcha.yml`. Falta decidir si compensa pasarlas a cada push. Y un camino del guion no ha
  corrido nunca: el que deja «sin comprobar» un paso cuando GitHub contesta 403 al runner.
- **Lo que sigue sin verse en vivo**, con sus pruebas pero sin haber pasado en la app:
  - un instalador cambiado tras la descarga **en la app instalada y elevada**, que es el caso
    exacto de T12-02; se vio en la copia de prueba, sin elevar (T13-05);
  - la descripción de la fila de un Java, un Deno o un Bun **de verdad**: en marcha solo se
    han visto copias de `PING.EXE` con esos nombres (T13-01);
  - un PID reciclado y una conexión lenta, que no se pueden provocar (T13-06).
- **Con «mostrar siempre todos los runtimes» encendido, la navegación del sidebar hace scroll**
  en la ventana de fábrica cuando además sale el aviso de administrador (T13-07). Es lo que el
  ajuste avisa, y por eso viene apagado; si molesta, lo que hay que repensar es el sidebar.

---

## 🔎 Revisión 2026-08-18 — cerrada

Auditoría estática del repositorio sobre la v1.3.1, en doce áreas: **37 tareas y ningún hallazgo
crítico**, cerradas las 37 el 2026-08-21. Cuatro se cerraron por decisión o por medición, no
escribiendo código: no habrá firma Authenticode (T4-02), el bundle no se divide porque no compensa
(T4-05), el rendimiento se midió (T4-03) y no había CI (T4-04, **revocada el 2026-09-23**: ver
CONTEXT §4). El detalle, en [docs/REVISION-2026-08-18.md](docs/REVISION-2026-08-18.md).

> **Los numerados se distinguen por el prefijo:** `Tier 4` es un Tier de este documento, `T4-01`
> una tarea de aquella revisión, `T12-01` una del [Tier 12](docs/TIER-12.md) y `T13-01` una del
> [Tier 13](docs/TIER-13.md).
