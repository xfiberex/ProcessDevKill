import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import type {
  KillSource,
  Language,
  Runtime,
  ServiceFamily,
  ServiceState,
  StartType,
  Theme,
} from "./types";
import type { SortKey } from "./lib/sort";

/**
 * Los textos de la ventana, en los dos idiomas.
 *
 * **El español es el original y el inglés se deriva de él**: `es` se escribe primero, `Catalogo`
 * es literalmente `typeof es`, y `en` se declara de ese tipo. Una clave que se añada al español y
 * se olvide en inglés **no compila**, y una que sobre en inglés tampoco. Es la misma garantía que
 * da `textos.rs` en Rust con su `struct` de dos constantes, y por el mismo motivo: un mapa de
 * claves daría `undefined` en tiempo de ejecución, que es enterarse cuando ya lo ve el usuario.
 *
 * Las frases con número son **funciones**, no plantillas: «1 cierre registrado» y «3 cierres
 * registrados» cambian la frase entera, no solo el sustantivo. Ese descuido ya salió tres veces en
 * este proyecto —«Se terminarán los 1 procesos», «1 cierre registrados» y «1 procesos Node
 * cerrados»—, así que aquí el plural se resuelve donde se escribe el texto.
 *
 * El contexto arranca **con el catálogo español por defecto**, y eso es lo que permite que las 175
 * pruebas que ya existían sigan pasando sin envolver nada: un componente renderizado suelto habla
 * español, igual que antes. Las cadenas españolas se copiaron aquí **carácter a carácter** por esa
 * misma razón.
 */

// ---------------------------------------------------------------- texto rico ---

/**
 * Texto con dos marcas: `**negrita**` y `` `código` ``.
 *
 * La alternativa era guardar JSX en el catálogo, y entonces cada párrafo con un `<strong>` dentro
 * habría que escribirlo con su marcado **dos veces**, una por idioma. Con las marcas, el catálogo
 * son cadenas puras —fáciles de comparar entre idiomas de un vistazo— y el marcado vive en un solo
 * sitio, `Rico`. Los `<strong>` de esta app no son adorno: llevan los avisos que no se pueden
 * pasar por alto («sin pedir confirmación», «Ningún proceso se ha cerrado»), así que perderlos
 * para simplificar no era una opción.
 */
export type Rico = string;

const MARCAS = /(\*\*[^*]+\*\*|`[^`]+`)/g;

/** Pinta un [`Rico`] resolviendo sus marcas. Fuera de ellas, el texto va tal cual. */
export function Marcado({ texto }: { texto: Rico }): ReactNode {
  return texto.split(MARCAS).map((trozo, i) => {
    if (trozo.startsWith("**") && trozo.endsWith("**")) {
      return (
        <strong key={i} className="font-medium text-foreground">
          {trozo.slice(2, -2)}
        </strong>
      );
    }
    if (trozo.startsWith("`") && trozo.endsWith("`")) {
      return (
        <code key={i} className="text-foreground">
          {trozo.slice(1, -1)}
        </code>
      );
    }
    return trozo;
  });
}

// ------------------------------------------------------------------ catálogo ---

/** Lista de puertos tal como se lee: «3000» o «3000, 5173». */
const puertos = (lista: number[]) => lista.join(", ");

export const es = {
  /**
   * Rótulo del selector de idioma. Va en los dos idiomas a la vez **en las dos entradas**, y no es
   * un descuido: quien abra la app y no entienda la mitad tiene que poder encontrar dónde se
   * cambia sin adivinar.
   */
  idioma: {
    titulo: "Idioma / Language",
    descripcion:
      "Cambia la ventana, el menú de la bandeja y las notificaciones de Windows. No hace falta reiniciar.",
    nombres: { es: "Español", en: "English" } satisfies Record<Language, string>,
  },

  /** Nombres de producto: no se traducen salvo «Otros», que sí es una palabra. */
  runtimes: {
    node: "Node.js",
    python: "Python",
    dotnet: ".NET",
    other: "Otros",
  } satisfies Record<Runtime, string>,

  origenes: {
    window: "Ventana",
    tray: "Bandeja",
    hotkey: "Ctrl+Alt+K",
    auto: "Auto-Kill",
  } satisfies Record<KillSource, string>,

  temas: {
    system: "Sistema",
    light: "Claro",
    dark: "Oscuro",
  } satisfies Record<Theme, string>,

  /** Encabezados de la tabla de procesos, uno por columna ordenable. */
  columnas: {
    name: "Proceso",
    port: "Puerto",
    pid: "PID",
    cpu: "CPU",
    memoryMb: "RAM",
    runTimeSecs: "Activo",
  } satisfies Record<SortKey, string>,

  sidebar: {
    subtitulo: "Process Manager",
    procesos: "Procesos",
    todos: "Todos",
    servicios: "Servicios",
    historial: "Historial",
    ajustes: "Ajustes",
    autoRefresco: "Auto-refresco",
  },

  medidor: {
    titulo: "Tu entorno",
    enPausa: "En pausa",
    midiendo: "Midiendo…",
    equipo: "Equipo",
    tituloCpu: (dev: string, total: string) =>
      `Tus procesos vigilados usan el ${dev} de la CPU. El equipo entero, el ${total}.`,
    tituloRam: (dev: string, usada: string, instalada: string) =>
      `Tus procesos vigilados usan ${dev}. El equipo entero, ${usada} de los ${instalada} instalados.`,
  },

  cabecera: {
    buscarPlaceholder: "Buscar por nombre, PID o puerto…",
    buscarLabel: "Buscar procesos",
    enLaLista: (n: number): string =>
      n === 1 ? "1 proceso en la lista" : `${n} procesos en la lista`,
    refrescar: "Refrescar",
    matar: (n: number) => `Matar ${n}`,
    nukeAll: "Nuke All",
  },

  vacio: {
    sinCoincidencias: "Ningún proceso coincide con el filtro.",
    sinProcesos: "No hay procesos de desarrollo activos.",
    sugerencia:
      "Node, Python y .NET se vigilan siempre. Si trabajas con otros —`docker`, `go`, `php`—, añádelos en Ajustes." as Rico,
    boton: "Añadir procesos vigilados",
  },

  tabla: {
    caption: "Procesos de desarrollo activos",
    seleccionarTodos: "Seleccionar todos",
    seleccionarPid: (pid: number) => `Seleccionar PID ${pid}`,
    acciones: "Acciones",
    zombi: "Zombi",
    zombiTitulo: (parado: string, lista: number[]) =>
      `Sin actividad desde hace ${parado}, y sigue ocupando ${
        lista.length === 1 ? "el puerto" : "los puertos"
      } ${puertos(lista)}`,
    kill: "Kill",
    killLabel: (name: string, pid: number) => `Cerrar ${name}, PID ${pid}`,
    matarProceso: "Matar proceso",
    copiarPid: "Copiar PID",
    copiarNombre: "Copiar nombre",
    copiarPuertos: (n: number): string => (n === 1 ? "Copiar puerto" : "Copiar puertos"),
    copiarUrl: (url: string) => `Copiar ${url}`,
    /** Lo que se nombra en el toast «Copiado: …» al copiar los puertos de una fila. */
    quePuertos: (lista: number[]): string =>
      lista.length === 1 ? `puerto ${lista[0]}` : `puertos ${puertos(lista)}`,
  },

  servicios: {
    titulo: "Servicios de desarrollo",
    cargando: "Leyendo los servicios…",
    /**
     * Que la vista es de solo lectura se dice **en la propia vista**, no solo en el roadmap. Un
     * panel que enseña servicios invita a pulsar algo; si no hay nada que pulsar, hay que explicar
     * por qué antes de que el usuario lo busque.
     */
    descripcion:
      "Los que instalan las herramientas de desarrollo y arrancan con Windows sin que se note. Por ahora **solo se leen**: esta versión no arranca, no detiene y no cambia nada." as Rico,
    recuento: (n: number) => (n === 1 ? "1 servicio" : `${n} servicios`),
    vacio: "No se ha encontrado ningún servicio de desarrollo.",
    vacioDetalle:
      "Se buscan SQL Server, PostgreSQL, MySQL, MongoDB, Redis, Docker e IIS. Si usas otro, añádelo en Ajustes." as Rico,
    irAAjustes: "Añadir servicios vigilados",
    caption: "Servicios de desarrollo instalados, los que estan corriendo primero",
    columnas: {
      servicio: "Servicio",
      estado: "Estado",
      arranque: "Arranque",
      ram: "RAM",
      puertos: "Puertos",
    },
    estados: {
      running: "Corriendo",
      stopped: "Parado",
      pending: "Cambiando…",
    } satisfies Record<ServiceState, string>,
    arranques: {
      boot: "Arranque del sistema",
      system: "Inicio del sistema",
      automatic: "Automático",
      automaticDelayed: "Automático (retrasado)",
      manual: "Manual",
      disabled: "Deshabilitado",
      unknown: "Desconocido",
    } satisfies Record<StartType, string>,
    familias: {
      sqlServer: "SQL Server",
      postgres: "PostgreSQL",
      mySql: "MySQL",
      mongoDb: "MongoDB",
      redis: "Redis",
      docker: "Docker",
      iis: "IIS",
      other: "Otros",
    } satisfies Record<ServiceFamily, string>,
    /** Por qué la RAM sale casi siempre en blanco. Va como `title`, donde se busca. */
    ramDesconocida:
      "La RAM de un servicio solo se puede leer con permisos de administrador, y ProcessDevKill no los pide.",
    sinPuertos:
      "No escucha en ningún puerto TCP. Es normal: SQL Express, por ejemplo, viene con TCP/IP desactivado.",
    pidTitulo: (pid: number) => `PID ${pid}`,
    arrancaSolo: "Arranca con Windows",
  },

  historial: {
    vacio: "Todavía no se ha cerrado ningún proceso.",
    // La frase entera cambia de número, no solo el sustantivo: singularizar «cierre» y dejar
    // «registrados» daba «1 cierre registrados».
    recuento: (n: number): string =>
      n === 1 ? "1 cierre registrado" : `${n} cierres registrados`,
    vaciar: "Vaciar historial",
    caption: "Procesos cerrados, del mas reciente al mas antiguo",
    cuando: "Cuándo",
    proceso: "Proceso",
    pid: "PID",
    puertosLiberados: "Puertos liberados",
    origen: "Origen",
  },

  confirmar: {
    cancelar: "Cancelar",
    cerrarTitulo: (n: number) => `Cerrar ${n} ${n === 1 ? "proceso" : "procesos"}`,
    cerrarMensaje: (n: number, ambito: string) =>
      `Se ${n === 1 ? "terminará" : "terminarán"} ${ambito}. ${
        n === 1 ? "El proceso se cierra" : "Los procesos se cierran"
      } de golpe, sin guardar nada. Esta acción no se puede deshacer.`,
    cerrarBoton: (n: number): string => (n === 1 ? "Cerrar proceso" : "Cerrar procesos"),
    ambitoSeleccionados: (n: number): string =>
      n === 1 ? "el proceso seleccionado" : `los ${n} procesos seleccionados`,
    ambitoTodos: "todos los procesos de desarrollo activos",
    ambitoFiltrados: "todos los procesos de la lista filtrada",
    vaciarTitulo: "Vaciar el historial",
    vaciarMensaje:
      "Se borrará el registro de procesos cerrados. No afecta a ningún proceso en ejecución.",
    vaciarBoton: "Vaciar",
  },

  avisos: {
    ajustesNoGuardados: "No se pudieron guardar los ajustes",
    noSePudoTerminar: "No se pudo terminar el proceso",
    fallosParciales: (fallidos: number, total: number) =>
      `${fallidos} de ${total} no se pudieron terminar`,
    cerradoUno: (name: string) => `${name} cerrado`,
    cerradosVarios: (n: number) => `${n} procesos cerrados`,
    puertosLiberados: (lista: number[]): string =>
      lista.length === 1
        ? `Puerto ${lista[0]} liberado`
        : `Puertos ${puertos(lista)} liberados`,
    copiado: (que: string) => `Copiado: ${que}`,
    noSePudoCopiar: (e: string) => `No se pudo copiar: ${e}`,
    historialNoVaciado: "No se pudo vaciar el historial",
    hayVersion: (version: string) => `ProcessDevKill v${version} disponible`,
    hayVersionComo: "Ábrelo en Ajustes para descargarlo e instalarlo.",
    irAAjustes: "Ajustes",
    rutaCopiada: "Ruta copiada",
    carpetaNoAbierta: "No se pudo abrir la carpeta",
    rutaNoCopiada: "No se pudo copiar la ruta",
    recursoNoAbierto: (nombre: string) => `No se pudo abrir ${nombre}`,
    navegadorNoAbierto: "No se pudo abrir el navegador",
    serviciosNoLeidos: "No se pudieron leer los servicios",
  },

  ajustes: {
    apariencia: {
      titulo: "Apariencia",
      descripcion:
        "Con **Sistema**, la app cambia sola cuando Windows pasa de claro a oscuro." as Rico,
    },
    vigilados: {
      titulo: "Procesos vigilados",
      descripcion:
        "Node, Python y .NET se vigilan siempre. Aquí puedes añadir otros ejecutables, como `docker`, `go` o `php`. Se compara el nombre exacto, sin la extensión." as Rico,
      placeholder: "nombre del ejecutable",
      anadir: "Añadir",
      /**
       * El nombre accesible del botón, que **no** es el texto que se ve.
       *
       * Hay dos botones «Añadir» en esta pantalla —procesos y servicios— y anunciados a secas son
       * indistinguibles para un lector de pantalla. Contiene la palabra visible, como pide el
       * criterio 2.5.3 de WCAG. Salió al añadir el segundo: cinco pruebas dejaron de saber cuál
       * pulsar, que es la misma duda que tendría una persona.
       */
      anadirLabel: "Añadir proceso vigilado",
      quitar: (nombre: string) => `Quitar ${nombre}`,
    },
    servicios: {
      titulo: "Servicios vigilados",
      descripcion:
        "SQL Server, PostgreSQL, MySQL, MongoDB, Redis, Docker e IIS se vigilan siempre. Aquí puedes añadir otros por su **nombre de servicio** —el corto, `MSSQL$SQLEXPRESS`, no el que enseña Windows—. Se compara exacto." as Rico,
      placeholder: "nombre del servicio",
      anadir: "Añadir",
      anadirLabel: "Añadir servicio vigilado",
      quitar: (nombre: string) => `Quitar ${nombre}`,
    },
    autoKill: {
      titulo: "Auto-Kill por memoria",
      interruptor: "Cerrar solos los procesos que se pasen de RAM",
      detalle:
        "Vigila los procesos de la lista y cierra **sin pedir confirmación** el que supere el umbral. Pensado para fugas de memoria y watchers desbocados. Avisa por notificación y queda en el historial como **Auto-Kill**." as Rico,
      campoLabel: "Umbral de RAM en MB",
      unidad: (equivalencia: string | null, minimo: number) =>
        `MB por proceso${equivalencia ? ` (${equivalencia})` : ""}. Mínimo ${minimo} MB.`,
    },
    zombie: {
      titulo: "Zombie Finder",
      interruptor: "Resaltar los procesos olvidados",
      detalle:
        "Marca en la tabla los que llevan un rato sin consumir CPU **y siguen ocupando un puerto**: el servidor de la semana pasada que aún tiene cogido el 3000. No cierra nada, solo lo señala." as Rico,
      campoLabel: "Minutos sin actividad",
      unidad: (minimo: number) => `minutos parado. Mínimo ${minimo}.`,
    },
    actualizaciones: {
      titulo: "Actualizaciones",
      descripcion:
        "La app comprueba al arrancar si hay una versión nueva en GitHub. Es lo **único** que consulta en la red, y solo descarga si lo confirmas." as Rico,
    },
    acercaDe: {
      titulo: "Acerca de",
      descripcion: (version: string) =>
        `ProcessDevKill${version} — software libre bajo **GPL-3.0**. Los componentes de terceros que la app empaqueta, con sus licencias, están en los avisos.` as Rico,
      licencia: "Licencia",
      avisos: "Avisos de terceros",
      repositorio: "Repositorio",
      logTitulo: "Registro de avisos",
      logDescripcion:
        "Cuando algo falla por dentro —guardar los ajustes, leer los puertos—, la app lo anota aquí. Es un archivo local: **no se envía a ninguna parte** y puedes borrarlo cuando quieras. Si abres un issue, adjuntarlo ayuda." as Rico,
      abrirCarpeta: "Abrir la carpeta",
      copiarRuta: "Copiar la ruta",
    },
    alCerrar: {
      titulo: "Al cerrar la ventana",
      interruptor: "Dejarla en la bandeja en vez de cerrar la app",
      detalle:
        "Con esto activado, el botón **✕** esconde la ventana y ProcessDevKill **sigue funcionando** en segundo plano: el Auto-Kill y el atajo global siguen vigilando. Para recuperarla, pulsa su icono en la bandeja; para salir del todo, **Salir** en el menú de ese icono." as Rico,
    },
    atajo: {
      titulo: "Atajo global",
      /** Va delante del `<kbd>`, que es estructura y se queda en el componente. */
      activar: "Activar",
      detalle:
        "Cierra **todos** los procesos vigilados al instante, funcione o no la ventana, y **sin pedir confirmación**. Queda registrado en el historial." as Rico,
    },
  },

  actualizador: {
    buscar: "Buscar actualizaciones",
    alDia: "Ya tienes la última versión.",
    error: (mensaje: string) => `No se pudo comprobar: ${mensaje}`,
    hayVersion: "Hay una versión nueva:",
    instalar: "Descargar e instalar",
    comoInstala:
      "Se instala en silencio: la app se cierra, se actualiza y vuelve a abrirse sola. No hay que responder a ninguna ventana.",
    descargando: "Descargando…",
    progresoLabel: "Progreso de la descarga",
    instalando: "Instalando y reiniciando…",
  },

  error: {
    titulo: "La ventana ha fallado",
    // El `**…**` de aquí es el mismo que en el resto: lo que no se puede pasar por alto es que
    // esto no ha matado nada.
    cuerpo:
      "Algo se ha roto al pintar la interfaz. **Ningún proceso se ha cerrado** por esto, y tus ajustes y tu historial siguen en su sitio." as Rico,
    recargar: "Recargar la ventana",
  },
};

/** La forma del catálogo, derivada del español. El inglés tiene que encajar aquí exactamente. */
export type Catalogo = typeof es;

export const en: Catalogo = {
  idioma: {
    titulo: "Idioma / Language",
    descripcion:
      "Changes the window, the tray menu and the Windows notifications. No restart needed.",
    nombres: { es: "Español", en: "English" },
  },

  runtimes: {
    node: "Node.js",
    python: "Python",
    dotnet: ".NET",
    other: "Other",
  },

  origenes: {
    window: "Window",
    tray: "Tray",
    hotkey: "Ctrl+Alt+K",
    auto: "Auto-Kill",
  },

  temas: {
    system: "System",
    light: "Light",
    dark: "Dark",
  },

  columnas: {
    name: "Process",
    port: "Port",
    pid: "PID",
    cpu: "CPU",
    memoryMb: "RAM",
    runTimeSecs: "Uptime",
  },

  sidebar: {
    subtitulo: "Process Manager",
    procesos: "Processes",
    todos: "All",
    servicios: "Services",
    historial: "History",
    ajustes: "Settings",
    autoRefresco: "Auto-refresh",
  },

  medidor: {
    titulo: "Your environment",
    enPausa: "Paused",
    midiendo: "Measuring…",
    equipo: "Machine",
    tituloCpu: (dev, total) =>
      `Your watched processes are using ${dev} of the CPU. The whole machine, ${total}.`,
    tituloRam: (dev, usada, instalada) =>
      `Your watched processes are using ${dev}. The whole machine, ${usada} of the ${instalada} installed.`,
  },

  cabecera: {
    buscarPlaceholder: "Search by name, PID or port…",
    buscarLabel: "Search processes",
    enLaLista: (n) => (n === 1 ? "1 process listed" : `${n} processes listed`),
    refrescar: "Refresh",
    matar: (n) => `Kill ${n}`,
    nukeAll: "Nuke All",
  },

  vacio: {
    sinCoincidencias: "No process matches the filter.",
    sinProcesos: "No development processes running.",
    sugerencia:
      "Node, Python and .NET are always watched. If you work with others —`docker`, `go`, `php`—, add them in Settings.",
    boton: "Add watched processes",
  },

  tabla: {
    caption: "Active development processes",
    seleccionarTodos: "Select all",
    seleccionarPid: (pid) => `Select PID ${pid}`,
    acciones: "Actions",
    zombi: "Zombie",
    zombiTitulo: (parado, lista) =>
      `Idle for ${parado}, and still holding ${
        lista.length === 1 ? "port" : "ports"
      } ${puertos(lista)}`,
    kill: "Kill",
    killLabel: (name, pid) => `Close ${name}, PID ${pid}`,
    matarProceso: "Kill process",
    copiarPid: "Copy PID",
    copiarNombre: "Copy name",
    copiarPuertos: (n) => (n === 1 ? "Copy port" : "Copy ports"),
    copiarUrl: (url) => `Copy ${url}`,
    quePuertos: (lista) =>
      lista.length === 1 ? `port ${lista[0]}` : `ports ${puertos(lista)}`,
  },

  servicios: {
    titulo: "Development services",
    cargando: "Reading the services…",
    descripcion:
      "The ones your development tools install, starting with Windows without you noticing. For now they are **read-only**: this version does not start, stop or change anything.",
    recuento: (n) => (n === 1 ? "1 service" : `${n} services`),
    vacio: "No development service was found.",
    vacioDetalle:
      "SQL Server, PostgreSQL, MySQL, MongoDB, Redis, Docker and IIS are looked for. If you use another one, add it in Settings.",
    irAAjustes: "Add watched services",
    caption: "Installed development services, running ones first",
    columnas: {
      servicio: "Service",
      estado: "State",
      arranque: "Startup",
      ram: "RAM",
      puertos: "Ports",
    },
    estados: {
      running: "Running",
      stopped: "Stopped",
      pending: "Changing…",
    },
    arranques: {
      boot: "Boot start",
      system: "System start",
      automatic: "Automatic",
      automaticDelayed: "Automatic (delayed)",
      manual: "Manual",
      disabled: "Disabled",
      unknown: "Unknown",
    },
    familias: {
      sqlServer: "SQL Server",
      postgres: "PostgreSQL",
      mySql: "MySQL",
      mongoDb: "MongoDB",
      redis: "Redis",
      docker: "Docker",
      iis: "IIS",
      other: "Other",
    },
    ramDesconocida:
      "A service's RAM can only be read with administrator rights, and ProcessDevKill does not ask for them.",
    sinPuertos:
      "It is not listening on any TCP port. That is normal: SQL Express, for one, ships with TCP/IP disabled.",
    pidTitulo: (pid) => `PID ${pid}`,
    arrancaSolo: "Starts with Windows",
  },

  historial: {
    vacio: "No process has been closed yet.",
    recuento: (n) => (n === 1 ? "1 close recorded" : `${n} closes recorded`),
    vaciar: "Clear history",
    caption: "Closed processes, newest first",
    cuando: "When",
    proceso: "Process",
    pid: "PID",
    puertosLiberados: "Freed ports",
    origen: "Source",
  },

  confirmar: {
    cancelar: "Cancel",
    cerrarTitulo: (n) => `Close ${n} ${n === 1 ? "process" : "processes"}`,
    // «This will terminate …» y no el ámbito de primero: en inglés el ámbito empieza por
    // minúscula («the selected process»), y abrir la frase con él la deja mal escrita.
    cerrarMensaje: (n, ambito) =>
      `This will terminate ${ambito}. ${
        n === 1 ? "The process is closed" : "The processes are closed"
      } at once, without saving anything. This action cannot be undone.`,
    cerrarBoton: (n) => (n === 1 ? "Close process" : "Close processes"),
    ambitoSeleccionados: (n) =>
      n === 1 ? "the selected process" : `the ${n} selected processes`,
    ambitoTodos: "every active development process",
    ambitoFiltrados: "every process in the filtered list",
    vaciarTitulo: "Clear the history",
    vaciarMensaje:
      "The record of closed processes will be deleted. It does not affect any running process.",
    vaciarBoton: "Clear",
  },

  avisos: {
    ajustesNoGuardados: "Settings could not be saved",
    noSePudoTerminar: "The process could not be terminated",
    fallosParciales: (fallidos, total) =>
      `${fallidos} of ${total} could not be terminated`,
    cerradoUno: (name) => `${name} closed`,
    cerradosVarios: (n) => `${n} processes closed`,
    puertosLiberados: (lista) =>
      lista.length === 1
        ? `Port ${lista[0]} freed`
        : `Ports ${puertos(lista)} freed`,
    copiado: (que) => `Copied: ${que}`,
    noSePudoCopiar: (e) => `Could not copy: ${e}`,
    historialNoVaciado: "The history could not be cleared",
    hayVersion: (version) => `ProcessDevKill v${version} available`,
    hayVersionComo: "Open it in Settings to download and install it.",
    irAAjustes: "Settings",
    rutaCopiada: "Path copied",
    carpetaNoAbierta: "Could not open the folder",
    rutaNoCopiada: "Could not copy the path",
    recursoNoAbierto: (nombre) => `Could not open ${nombre}`,
    navegadorNoAbierto: "Could not open the browser",
    serviciosNoLeidos: "The services could not be read",
  },

  ajustes: {
    apariencia: {
      titulo: "Appearance",
      descripcion:
        "With **System**, the app follows Windows when it switches between light and dark.",
    },
    vigilados: {
      titulo: "Watched processes",
      descripcion:
        "Node, Python and .NET are always watched. Here you can add other executables, such as `docker`, `go` or `php`. The name is matched exactly, without the extension.",
      placeholder: "executable name",
      anadir: "Add",
      anadirLabel: "Add watched process",
      quitar: (nombre) => `Remove ${nombre}`,
    },
    servicios: {
      titulo: "Watched services",
      descripcion:
        "SQL Server, PostgreSQL, MySQL, MongoDB, Redis, Docker and IIS are always watched. Here you can add others by their **service name** —the short one, `MSSQL$SQLEXPRESS`, not the one Windows shows—. It is matched exactly.",
      placeholder: "service name",
      anadir: "Add",
      anadirLabel: "Add watched service",
      quitar: (nombre) => `Remove ${nombre}`,
    },
    autoKill: {
      titulo: "Auto-Kill by memory",
      interruptor: "Close processes that go over the RAM limit on their own",
      detalle:
        "Watches the processes in the list and closes the one that goes over the threshold **without asking for confirmation**. Meant for memory leaks and runaway watchers. It notifies you and is recorded in the history as **Auto-Kill**.",
      campoLabel: "RAM threshold in MB",
      unidad: (equivalencia, minimo) =>
        `MB per process${equivalencia ? ` (${equivalencia})` : ""}. Minimum ${minimo} MB.`,
    },
    zombie: {
      titulo: "Zombie Finder",
      interruptor: "Highlight forgotten processes",
      detalle:
        "Marks in the table the ones that have gone a while without using CPU **and are still holding a port**: last week's server still sitting on 3000. It closes nothing, it only points them out.",
      campoLabel: "Minutes without activity",
      unidad: (minimo) => `minutes idle. Minimum ${minimo}.`,
    },
    actualizaciones: {
      titulo: "Updates",
      descripcion:
        "The app checks GitHub for a new version at startup. It is the **only** thing it asks the network, and it only downloads if you confirm.",
    },
    acercaDe: {
      titulo: "About",
      descripcion: (version) =>
        `ProcessDevKill${version} — free software under **GPL-3.0**. The third-party components the app bundles, with their licences, are in the notices.`,
      licencia: "Licence",
      avisos: "Third-party notices",
      repositorio: "Repository",
      logTitulo: "Warning log",
      logDescripcion:
        "When something fails inside —saving the settings, reading the ports—, the app writes it down here. It is a local file: **it is never sent anywhere** and you can delete it whenever you want. Attaching it to an issue helps.",
      abrirCarpeta: "Open the folder",
      copiarRuta: "Copy the path",
    },
    alCerrar: {
      titulo: "When the window is closed",
      interruptor: "Leave it in the tray instead of quitting the app",
      detalle:
        "With this on, the **✕** button hides the window and ProcessDevKill **keeps running** in the background: Auto-Kill and the global shortcut go on watching. To bring it back, click its tray icon; to quit for good, **Quit** in that icon's menu.",
    },
    atajo: {
      titulo: "Global shortcut",
      activar: "Enable",
      detalle:
        "Closes **every** watched process at once, whether or not the window is working, and **without asking for confirmation**. It is recorded in the history.",
    },
  },

  actualizador: {
    buscar: "Check for updates",
    alDia: "You already have the latest version.",
    error: (mensaje) => `Could not check: ${mensaje}`,
    hayVersion: "There is a new version:",
    instalar: "Download and install",
    comoInstala:
      "It installs silently: the app closes, updates and opens again on its own. There is no window to answer.",
    descargando: "Downloading…",
    progresoLabel: "Download progress",
    instalando: "Installing and restarting…",
  },

  error: {
    titulo: "The window has failed",
    cuerpo:
      "Something broke while painting the interface. **No process has been closed** because of this, and your settings and your history are still there.",
    recargar: "Reload the window",
  },
};

export const CATALOGOS: Record<Language, Catalogo> = { es, en };

// -------------------------------------------------------------------- acceso ---

const I18nContext = createContext<Catalogo>(es);

/**
 * El catálogo vigente, para quien **no** está dentro del proveedor.
 *
 * Lo necesita `ErrorBoundary`, que envuelve a `App` desde `main.tsx` —a propósito: una barrera
 * puesta dentro no llegaría a montarse si el fallo estuviera en el propio `App`—. Al estar fuera,
 * el contexto le daría siempre el español. Para cuando esa pantalla llega a pintarse, los ajustes
 * hace rato que se cargaron, así que esta copia ya tiene el idioma bueno.
 */
let vigente: Catalogo = es;

/** Los textos del idioma elegido. Sin proveedor delante, español. */
export function useT(): Catalogo {
  return useContext(I18nContext);
}

/** El catálogo vigente sin pasar por React. **Solo para lo que vive fuera del proveedor.** */
export function catalogoVigente(): Catalogo {
  return vigente;
}

export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const catalogo = CATALOGOS[language] ?? es;

  // La copia para quien vive fuera del proveedor se actualiza en un efecto y no durante el render:
  // escribir una variable de módulo mientras se renderiza es un efecto secundario, y React no
  // promete cuántas veces va a llamar a esta función. El desfase no importa: en el primer render
  // el idioma es el de fábrica —español, el mismo que ya tiene `vigente`—, y los ajustes de verdad
  // llegan de Rust después de montar, con el efecto ya en marcha.
  useEffect(() => {
    vigente = catalogo;
  }, [catalogo]);

  return <I18nContext.Provider value={catalogo}>{children}</I18nContext.Provider>;
}
