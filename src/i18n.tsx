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
    nombres: { es: "Español", en: "English" } satisfies Record<
      Language,
      string
    >,
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
    /**
     * El aviso de que la app corre sin permisos de administrador, en el hueco bajo la navegación.
     *
     * Dice **qué** falta y no solo que falta algo: «sin administrador» a secas suena a error, y la
     * app funciona entera; lo que no ve son dos cosas concretas. El resto está en Ajustes, adonde
     * lleva el aviso.
     */
    sinAdmin: {
      titulo: "Sin modo administrador",
      detalle: "No se ve la RAM de los servicios ni el detalle de algunos procesos.",
      /** Solo para el lector de pantalla: a la vista, que es un botón lo dice el cursor. */
      destino: "Ver en Ajustes",
    },
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
    buscarPlaceholder: "Buscar por nombre, script, carpeta, PID o puerto…",
    buscarLabel: "Buscar procesos",
    enLaLista: (n: number): string =>
      n === 1 ? "1 proceso en la lista" : `${n} procesos en la lista`,
    refrescar: "Refrescar",
    nukeAll: "Nuke All",
    /**
     * Nuke All con un filtro o una búsqueda puestos (Tier 11, D3). Decía «Nuke All» igual, y lo que
     * cerraba era **la lista filtrada**: el rótulo prometía más de lo que hacía, al revés de lo
     * peligroso, pero había que ir al diálogo para saberlo. «Nuke» se queda en inglés, como Kill.
     */
    nukeFiltrados: "Nuke filtrados",
    nukeFiltradosLabel: (n: number): string =>
      n === 1
        ? "Nuke filtrados: cerrar el proceso de la lista filtrada"
        : `Nuke filtrados: cerrar los ${n} procesos de la lista filtrada`,
  },

  /**
   * La barra de la selección (Tier 11, D7): cuántos, cerrarlos y deshacer la selección.
   *
   * Hasta aquí seleccionar cambiaba el Nuke All de la cabecera por «Matar 3», y no había forma de
   * soltar la selección salvo desmarcar una a una.
   */
  seleccion: {
    recuento: (n: number): string =>
      n === 1 ? "1 seleccionado" : `${n} seleccionados`,
    cerrar: "Cerrar",
    cerrarLabel: (n: number): string =>
      n === 1 ? "Cerrar el proceso seleccionado" : `Cerrar los ${n} procesos seleccionados`,
    quitar: "Quitar selección",
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
    /**
     * Empieza por **«Kill»**, la palabra que se ve (Tier 11, B5; WCAG 2.5.3). Decía «Cerrar …», y
     * quien maneja el equipo por voz dice lo que lee: «clic en Kill» no encontraba el botón. Es el
     * criterio que ya seguían los dos «Añadir» de Ajustes. En inglés sale igual.
     */
    killLabel: (name: string, pid: number) => `Kill ${name}, PID ${pid}`,
    /** «Cerrar» y no «Matar» (Tier 11, D3): Kill y Nuke All en inglés; todo lo demás, «cerrar». */
    cerrarProceso: "Cerrar proceso",
    protegido: "Protegido",
    /** Va en el `title` del candado y en el del Kill apagado: dice qué lo frena y cómo quitarlo. */
    protegidoTitulo:
      "Protegido: ni Kill, ni Nuke All, ni la bandeja, ni el atajo, ni el Auto-Kill lo cierran. Se quita desde el menú de la fila o en Ajustes.",
    proteger: (clave: string) => `Proteger «${clave}»`,
    desproteger: (clave: string) => `Dejar de proteger «${clave}»`,
    copiarPid: "Copiar PID",
    copiarNombre: "Copiar nombre",
    copiarPuertos: (n: number): string =>
      n === 1 ? "Copiar puerto" : "Copiar puertos",
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
      "Los que arrancan con Windows sin que se note." as Rico,
    /** En un desplegable bajo la descripción (Tier 11, D1): se lee una vez, no en cada visita. */
    porQueAdmin: "¿Por qué pide administrador?",
    porQueAdminDetalle:
      "Windows solo deja tocar un servicio con permisos de administrador. Si la app no corre como administrador, arrancar, detener o cambiar el arranque saca el aviso de UAC **solo para esa acción**. El tipo de arranque sobrevive al reinicio, así que cada cambio queda anotado abajo para poder deshacerlo." as Rico,
    recuento: (n: number) => (n === 1 ? "1 servicio" : `${n} servicios`),
    vacio: "No se ha encontrado ningún servicio de desarrollo.",
    vacioDetalle:
      "Se buscan SQL Server, PostgreSQL, MySQL, MongoDB, Redis, Docker e IIS. Si usas otro, añádelo en Ajustes." as Rico,
    irAAjustes: "Añadir servicios vigilados",
    caption:
      "Servicios de desarrollo instalados, los que estan corriendo primero",
    columnas: {
      servicio: "Servicio",
      estado: "Estado",
      arranque: "Arranque",
      ram: "RAM",
      puertos: "Puertos",
      acciones: "Acciones",
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
      "La RAM de un servicio solo se puede leer con permisos de administrador. La app puede arrancar con ellos desde Ajustes.",
    /** La app corre elevada y aun así no la pudo leer: no es cosa de permisos. */
    ramNoLeida: "No se pudo leer la RAM de este servicio.",
    /** El «—» de RAM y puertos de un servicio parado (Tier 11, D4): parado no ocupa ninguno. */
    parado: "Parado: no ocupa RAM ni puertos.",
    sinPuertos:
      "No escucha en ningún puerto TCP. Es normal: SQL Express, por ejemplo, viene con TCP/IP desactivado.",
    pidTitulo: (pid: number) => `PID ${pid}`,
    arrancaSolo: "Arranca con Windows",
    acciones: {
      arrancar: "Arrancar",
      detener: "Detener",
      /**
       * El nombre accesible lleva el servicio dentro.
       *
       * En una tabla hay un botón por fila, y «Detener» a secas se repite tantas veces como
       * servicios: para quien navega con lector de pantalla eso es una lista de botones idénticos.
       * Mismo arreglo que el de los dos «Añadir» de Ajustes.
       */
      arrancarLabel: (n: string) => `Arrancar ${n}`,
      detenerLabel: (n: string) => `Detener ${n}`,
      trabajando: "Esperando a Windows…",
      detenerTitulo: (n: string) => `Detener ${n}`,
      detenerMensaje: (n: string): string =>
        `Windows detendrá ${n}. Lo que esté usándolo en este momento —una conexión abierta, una consulta a medias— se corta. Se puede volver a arrancar desde aquí.`,
      detenerBoton: "Detener servicio",
      /**
       * Las dependencias se enseñan **antes** de detener, no después de fallar.
       *
       * Windows contesta `ERROR_DEPENDENT_SERVICES_RUNNING` y no toca nada; enterarse de eso
       * después de haber pasado por un UAC es la peor forma de descubrirlo.
       */
      dependientes: (nombres: string[]): string =>
        nombres.length === 1
          ? `Windows no lo detendrá mientras ${nombres[0]} siga corriendo. Detén ese primero.`
          : `Windows no lo detendrá mientras sigan corriendo estos: ${nombres.join(", ")}. Detén esos primero.`,
      pideAdmin:
        "Hará falta aprobar el aviso de administrador de Windows. Se eleva solo esta acción, y solo mientras dura.",
      arrancado: (n: string) => `${n} está corriendo.`,
      detenido: (n: string) => `${n} está parado.`,
      /** Ni «hecho» ni «falló»: el SCM aceptó y el servicio todavía está en ello. */
      enTransicion: (n: string) =>
        `${n} sigue cambiando de estado. Refresca dentro de unos segundos para ver en qué queda.`,
      bloqueado: (n: string, nombres: string[]): string =>
        `No se pudo detener ${n}: sigue corriendo ${nombres.join(", ")}.`,
      rechazado: (n: string) =>
        `Windows no dejó completar la acción sobre ${n}.`,
    },
    arranque: {
      etiqueta: (n: string) => `Tipo de arranque de ${n}`,
      /** Para `boot` y `system`, que la app lee pero no pone. */
      noAjustable:
        "Este tipo de arranque es de controladores del sistema y no se cambia desde aquí.",
      titulo: (n: string) => `Cambiar el arranque de ${n}`,
      mensaje: (n: string, de: string, a: string): string =>
        `${n} pasará de «${de}» a «${a}».`,
      /**
       * **El aviso que hace distinta a esta acción de todas las demás de la app.**
       *
       * Todo lo que hace ProcessDevKill hasta aquí se deshace solo: un proceso cerrado vuelve la
       * próxima vez que se lanza. Esto no. Un servicio en «Deshabilitado» sigue deshabilitado
       * dentro de tres meses, cuando ya nadie recuerda que lo hizo esta app — así que se dice, y
       * se dice antes.
       */
      aviso:
        "**Este cambio sobrevive al reinicio** y lo hace en Windows, no dentro de la app. Queda anotado abajo para poder deshacerlo." as Rico,
      /**
       * El mismo aviso, para cuando lo que se pulsa es Deshacer.
       *
       * El de arriba dice «queda anotado abajo para poder deshacerlo», y al deshacer pasa lo
       * contrario: la entrada se va. Prometer un registro que no va a existir es pequeño, pero es
       * exactamente la clase de frase que enseña al usuario a no leer los avisos.
       */
      avisoDeshacer:
        "**Este cambio sobrevive al reinicio** y lo hace en Windows, no dentro de la app. El servicio vuelve a como estaba y sale de esta lista." as Rico,
      boton: "Cambiar arranque",
      hecho: (n: string, a: string) => `${n} queda en «${a}».`,
      rechazado: (n: string) => `Windows no dejó cambiar el arranque de ${n}.`,
      registroTitulo: "Cambios que ha hecho ProcessDevKill",
      registroDetalle:
        "Estos arranques los cambió la app y siguen así después de reiniciar. Deshacer devuelve cada uno a como estaba." as Rico,
      registroFila: (de: string, a: string) => `de «${de}» a «${a}»`,
      deshacer: "Deshacer",
      deshacerLabel: (n: string) => `Deshacer el cambio de arranque de ${n}`,
    },
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
    cerrarTitulo: (n: number) =>
      `Cerrar ${n} ${n === 1 ? "proceso" : "procesos"}`,
    cerrarMensaje: (n: number, ambito: string) =>
      `Se ${n === 1 ? "cerrará" : "cerrarán"} ${ambito}. ${
        n === 1 ? "El proceso se cierra" : "Los procesos se cierran"
      } de golpe, sin guardar nada. Esta acción no se puede deshacer.`,
    cerrarBoton: (n: number): string =>
      n === 1 ? "Cerrar proceso" : "Cerrar procesos",
    ambitoSeleccionados: (n: number): string =>
      n === 1 ? "el proceso seleccionado" : `los ${n} procesos seleccionados`,
    ambitoTodos: "todos los procesos de desarrollo activos",
    ambitoFiltrados: "todos los procesos de la lista filtrada",
    /** Se añade al mensaje cuando el lote deja fuera a alguno: que no parezca que se olvidó. */
    protegidosFuera: (n: number): string =>
      n === 1
        ? "El proceso protegido de la lista no se toca."
        : `Los ${n} procesos protegidos de la lista no se tocan.`,
    vaciarTitulo: "Vaciar el historial",
    vaciarMensaje:
      "Se borrará el registro de procesos cerrados. No afecta a ningún proceso en ejecución.",
    vaciarBoton: "Vaciar",
  },

  avisos: {
    ajustesNoGuardados: "No se pudieron guardar los ajustes",
    noSePudoCerrar: "No se pudo cerrar el proceso",
    /**
     * Se añade a un cierre fallido **solo si la app corre sin elevar**. Es el motivo más común y el
     * único que el usuario puede arreglar: Windows no deja a un proceso normal cerrar uno abierto
     * como administrador. Va como posibilidad y no como diagnóstico, porque también falla con un
     * proceso que acaba de morir por su cuenta.
     */
    quizaAdmin:
      "Si se abrió como administrador, la app necesita ese permiso para cerrarlo: ver Ajustes.",
    fallosParciales: (fallidos: number, total: number) =>
      `${fallidos} de ${total} no se pudieron cerrar`,
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
    protegido: (clave: string) => `«${clave}» protegido`,
    desprotegido: (clave: string) => `«${clave}» ya no está protegido`,
  },

  ajustes: {
    /** Los grupos de Ajustes (Tier 11, D2): diez secciones seguidas se leían como una lista. */
    grupos: {
      general: "General",
      vigilancia: "Vigilancia",
      automatismos: "Automatismos",
    },
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
    protegidos: {
      titulo: "Procesos protegidos",
      descripcion:
        "Lo que pongas aquí **no lo cierra nada** de la app: ni Kill, ni Nuke All, ni la bandeja, ni el atajo, ni el Auto-Kill. Vale el ejecutable (`node`), el script (`vite`) o la carpeta del proyecto (`mi-api`), exacto. También se protege desde el menú de cada fila." as Rico,
      placeholder: "ejecutable, script o carpeta",
      anadir: "Añadir",
      anadirLabel: "Añadir proceso protegido",
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
      apoyar: "Apoyar el proyecto",
      apoyarDetalle:
        "La app es gratis y lo seguirá siendo. Apoyarla es voluntario y no desbloquea nada.",
      logTitulo: "Registro de avisos",
      logDescripcion:
        "Cuando algo falla por dentro —guardar los ajustes, leer los puertos—, la app lo anota aquí. Es un archivo local: **no se envía a ninguna parte** y puedes borrarlo cuando quieras. Si abres un issue, adjuntarlo ayuda." as Rico,
      abrirCarpeta: "Abrir la carpeta",
      copiarRuta: "Copiar la ruta",
    },
    administrador: {
      titulo: "Permisos de administrador",
      estadoSi:
        "La app corre **como administrador**: ve la RAM de los servicios y el detalle de todos los procesos, y puede cerrarlos todos." as Rico,
      estadoNo:
        "La app corre **sin permisos de administrador**. Windows no le deja ver la RAM de los servicios, ni el script y la carpeta de los procesos abiertos como administrador —por ejemplo, desde una terminal elevada—, ni cerrarlos. Todo lo demás funciona igual." as Rico,
      reiniciar: "Reiniciar como administrador",
      interruptor: "Iniciar siempre como administrador",
      detalle:
        "Windows pedirá confirmación (**UAC**) cada vez que se abra la app. Si se cierra sin aprobarla, la app arranca igual, sin permisos. Se aplica desde el próximo arranque." as Rico,
      noSePudo: "No se pudo reiniciar como administrador",
    },
    alCerrar: {
      titulo: "Al cerrar la ventana",
      interruptor: "Dejarla en la bandeja en vez de cerrar la app",
      detalle:
        "Con esto activado, **el botón ✕** esconde la ventana y ProcessDevKill **sigue funcionando** en segundo plano: el Auto-Kill y el atajo global siguen vigilando. Para recuperarla, pulsa su icono en la bandeja; para salir del todo, **Salir** en el menú de ese icono." as Rico,
    },
    atajo: {
      titulo: "Atajo global",
      /** Va delante del `<kbd>`, que es estructura y se queda en el componente. */
      activar: "Activar",
      detalle:
        "Cierra **todos** los procesos vigilados que no estén protegidos, funcione o no la ventana. Es global: mientras esté activo, **ninguna otra app recibe esa combinación** —en los IDE de JetBrains, Ctrl+Alt+K es «Commit and Push»—. Queda registrado en el historial." as Rico,
      combinacion: "Combinación",
      doble: "Pedir dos pulsaciones",
      dobleDetalle:
        "La primera solo avisa de cuántos procesos caerían; la segunda, **dentro de 3 segundos**, los cierra. Sin esto, una pulsación suelta cierra todo sin preguntar." as Rico,
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
    sinAdmin: {
      titulo: "Not running as admin",
      detalle: "Service RAM and some process details are not visible.",
      destino: "See in Settings",
    },
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
    buscarPlaceholder: "Search by name, script, folder, PID or port…",
    buscarLabel: "Search processes",
    enLaLista: (n) => (n === 1 ? "1 process listed" : `${n} processes listed`),
    refrescar: "Refresh",
    nukeAll: "Nuke All",
    nukeFiltrados: "Nuke filtered",
    nukeFiltradosLabel: (n) =>
      n === 1
        ? "Nuke filtered: close the process in the filtered list"
        : `Nuke filtered: close the ${n} processes in the filtered list`,
  },

  seleccion: {
    recuento: (n) => (n === 1 ? "1 selected" : `${n} selected`),
    cerrar: "Close",
    cerrarLabel: (n) =>
      n === 1 ? "Close the selected process" : `Close the ${n} selected processes`,
    quitar: "Clear selection",
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
    killLabel: (name, pid) => `Kill ${name}, PID ${pid}`,
    cerrarProceso: "Close process",
    protegido: "Protected",
    protegidoTitulo:
      "Protected: neither Kill, Nuke All, the tray, the shortcut nor Auto-Kill will close it. Remove it from the row menu or in Settings.",
    proteger: (clave) => `Protect “${clave}”`,
    desproteger: (clave) => `Stop protecting “${clave}”`,
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
      "The ones that start with Windows without you noticing.",
    porQueAdmin: "Why does it ask for administrator?",
    porQueAdminDetalle:
      "Windows only lets administrators touch a service. If the app is not running as administrator, starting, stopping or changing the startup type shows the UAC prompt **just for that action**. The startup type survives a reboot, so each change is recorded below so you can undo it.",
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
      acciones: "Actions",
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
      "A service's RAM can only be read with administrator rights. The app can start with them from Settings.",
    ramNoLeida: "This service's RAM could not be read.",
    parado: "Stopped: it uses no RAM or ports.",
    sinPuertos:
      "It is not listening on any TCP port. That is normal: SQL Express, for one, ships with TCP/IP disabled.",
    pidTitulo: (pid) => `PID ${pid}`,
    arrancaSolo: "Starts with Windows",
    acciones: {
      arrancar: "Start",
      detener: "Stop",
      arrancarLabel: (n) => `Start ${n}`,
      detenerLabel: (n) => `Stop ${n}`,
      trabajando: "Waiting for Windows…",
      detenerTitulo: (n) => `Stop ${n}`,
      detenerMensaje: (n) =>
        `Windows will stop ${n}. Whatever is using it right now — an open connection, a query midway — gets cut off. You can start it again from here.`,
      detenerBoton: "Stop service",
      dependientes: (nombres) =>
        nombres.length === 1
          ? `Windows will not stop it while ${nombres[0]} keeps running. Stop that one first.`
          : `Windows will not stop it while these keep running: ${nombres.join(", ")}. Stop those first.`,
      pideAdmin:
        "You will have to approve the Windows administrator prompt. Only this action runs elevated, and only while it lasts.",
      arrancado: (n) => `${n} is running.`,
      detenido: (n) => `${n} is stopped.`,
      enTransicion: (n) =>
        `${n} is still changing state. Refresh in a few seconds to see where it lands.`,
      bloqueado: (n, nombres) =>
        `${n} could not be stopped: ${nombres.join(", ")} is still running.`,
      rechazado: (n) => `Windows did not let the action on ${n} go through.`,
    },
    arranque: {
      etiqueta: (n) => `Startup type for ${n}`,
      noAjustable:
        "This startup type belongs to system drivers and cannot be changed from here.",
      titulo: (n) => `Change startup for ${n}`,
      mensaje: (n, de, a) => `${n} will go from "${de}" to "${a}".`,
      aviso:
        "**This change survives a reboot** and it happens in Windows, not inside the app. It is recorded below so you can undo it.",
      avisoDeshacer:
        "**This change survives a reboot** and it happens in Windows, not inside the app. The service goes back to how it was and leaves this list.",
      boton: "Change startup",
      hecho: (n, a) => `${n} is now set to "${a}".`,
      rechazado: (n) => `Windows did not let the startup of ${n} change.`,
      registroTitulo: "Changes ProcessDevKill made",
      registroDetalle:
        "The app changed these startup types and they stay that way after a reboot. Undo puts each one back the way it was.",
      registroFila: (de, a) => `from "${de}" to "${a}"`,
      deshacer: "Undo",
      deshacerLabel: (n) => `Undo the startup change for ${n}`,
    },
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
      `This will close ${ambito}. ${
        n === 1 ? "The process is closed" : "The processes are closed"
      } at once, without saving anything. This action cannot be undone.`,
    cerrarBoton: (n) => (n === 1 ? "Close process" : "Close processes"),
    ambitoSeleccionados: (n) =>
      n === 1 ? "the selected process" : `the ${n} selected processes`,
    ambitoTodos: "every active development process",
    ambitoFiltrados: "every process in the filtered list",
    protegidosFuera: (n) =>
      n === 1
        ? "The protected process in the list is left alone."
        : `The ${n} protected processes in the list are left alone.`,
    vaciarTitulo: "Clear the history",
    vaciarMensaje:
      "The record of closed processes will be deleted. It does not affect any running process.",
    vaciarBoton: "Clear",
  },

  avisos: {
    ajustesNoGuardados: "Settings could not be saved",
    noSePudoCerrar: "The process could not be closed",
    quizaAdmin:
      "If it was opened as administrator, the app needs that right to close it: see Settings.",
    fallosParciales: (fallidos, total) =>
      `${fallidos} of ${total} could not be closed`,
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
    protegido: (clave) => `“${clave}” protected`,
    desprotegido: (clave) => `“${clave}” is no longer protected`,
  },

  ajustes: {
    grupos: {
      general: "General",
      vigilancia: "Watching",
      automatismos: "Automation",
    },
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
    protegidos: {
      titulo: "Protected processes",
      descripcion:
        "What you add here is **never closed by the app**: not by Kill, Nuke All, the tray, the shortcut or Auto-Kill. It can be the executable (`node`), the script (`vite`) or the project folder (`my-api`), matched exactly. You can also protect a process from its row menu.",
      placeholder: "executable, script or folder",
      anadir: "Add",
      anadirLabel: "Add protected process",
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
      apoyar: "Support the project",
      apoyarDetalle:
        "The app is free and will stay that way. Supporting it is optional and unlocks nothing.",
      logTitulo: "Warning log",
      logDescripcion:
        "When something fails inside —saving the settings, reading the ports—, the app writes it down here. It is a local file: **it is never sent anywhere** and you can delete it whenever you want. Attaching it to an issue helps.",
      abrirCarpeta: "Open the folder",
      copiarRuta: "Copy the path",
    },
    administrador: {
      titulo: "Administrator rights",
      estadoSi:
        "The app is running **as administrator**: it sees service RAM and the details of every process, and can close them all.",
      estadoNo:
        "The app is running **without administrator rights**. Windows does not let it see service RAM, or the script and folder of processes opened as administrator — from an elevated terminal, for instance — or close them. Everything else works the same.",
      reiniciar: "Restart as administrator",
      interruptor: "Always start as administrator",
      detalle:
        "Windows will ask for confirmation (**UAC**) every time the app opens. If it is closed without approving, the app starts anyway, without the rights. Takes effect from the next start.",
      noSePudo: "Could not restart as administrator",
    },
    alCerrar: {
      titulo: "When the window is closed",
      interruptor: "Leave it in the tray instead of quitting the app",
      detalle:
        "With this on, **the ✕ button** hides the window and ProcessDevKill **keeps running** in the background: Auto-Kill and the global shortcut go on watching. To bring it back, click its tray icon; to quit for good, **Quit** in that icon's menu.",
    },
    atajo: {
      titulo: "Global shortcut",
      activar: "Enable",
      detalle:
        "Closes **every** watched process that is not protected, whether or not the window is working. It is global: while it is on, **no other app receives that combination** —in JetBrains IDEs, Ctrl+Alt+K is “Commit and Push”—. It is recorded in the history.",
      combinacion: "Combination",
      doble: "Require two presses",
      dobleDetalle:
        "The first one only tells you how many processes would go; the second, **within 3 seconds**, closes them. Without this, a single stray press closes everything without asking.",
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

  return (
    <I18nContext.Provider value={catalogo}>{children}</I18nContext.Provider>
  );
}
