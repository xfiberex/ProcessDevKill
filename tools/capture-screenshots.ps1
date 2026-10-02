<#
.SYNOPSIS
    Regenera las capturas del README conduciendo la app de verdad.

.DESCRIPTION
    Lanza una copia de ProcessDevKill en modo desarrollo con el puerto de depuración de
    WebView2 abierto, se conecta por CDP, mueve la interfaz (tema, menú contextual, Servicios
    y Ajustes) y guarda un PNG de cada estado en docs/screenshots/.

    NO TOCA NADA DEL USUARIO (T12-28)
    La copia arranca con OTRO IDENTIFICADOR (`com.processdevkill.app.capturas`), que entra por
    `--config` en un archivo temporal. Del identificador salen la carpeta de datos, la de
    WebView2 y el candado de instancia única, así que la copia:
      - no lee ni escribe el `settings.json` del usuario: usa uno propio, que este script
        escribe antes de arrancar y borra al terminar. Hasta el 2026-10-02 cambiaba el tema
        del usuario por la interfaz y lo devolvía igual; si fallaba a medias, se quedaba
        cambiado;
      - sale siempre en español y con los mismos ajustes, los genere quien los genere. Antes
        buscaba los botones por su texto en español sobre los ajustes de quien lo lanzara, y
        con la app en inglés abortaba;
      - no choca con la app abierta del usuario, ni arranca elevada aunque él tenga encendido
        «Iniciar siempre como administrador». Por eso ya no hace falta la guardia de T12-27;
      - no abre `tauri.conf.json` para escribir. `release.ps1` se niega a cortar si ese
        archivo lleva un puerto de depuración; aquí ya no puede quedarse dentro por accidente.
    Es el mismo mecanismo que `tools/prueba-en-marcha.mjs`, con otro identificador para que
    las dos cosas no se pisen la carpeta.

    Las imágenes salen del propio webview (`Page.captureScreenshot`), no de la pantalla:
    no llevan barra de título ni fondo de escritorio, y miden siempre lo mismo gracias a
    `Emulation.setDeviceMetricsOverride`, sin importar la resolución ni el escalado de
    Windows del equipo que las genere. Se capturan a x2 para que se vean nítidas en
    pantallas HiDPI y en el zoom de GitHub.

    EL PUERTO DE DEPURACIÓN
    Solo se puede pedir por `additionalBrowserArgs`. La variable de entorno
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS no vale: Tauri la sobrescribe. El valor que se
    escribe conserva además los argumentos por defecto de Tauri, porque
    `additionalBrowserArgs` los sustituye en bloque en vez de añadirse a ellos: sin eso, el
    webview de las capturas no se comportaría como el de la app publicada.

    LO QUE ESTE MÉTODO NO PUEDE CAPTURAR
    Todo lo que dibuje Windows por encima del webview: el menú de la bandeja y las
    notificaciones nativas. Los toast de la app sí salen, porque son HTML (Sonner). Para lo
    nativo no hay atajo — `Graphics.CopyFromScreen` tampoco los recoge, se probó y salen
    capturas vacías (.claude/CLAUDE.md): o lo fotografía una persona, o no sale.

    LOS SERVIDORES DE DEMOSTRACIÓN
    La columna de puertos es la razón de ser de la app, así que una captura sin ningún
    puerto ocupado no sirve de nada. El script levanta dos servidores Node de verdad
    (3000 y 8080) mientras dura la sesión y los cierra al terminar; uno de ellos hace algo
    de trabajo para que las barras de CPU no salgan todas a cero. Con -SkipDemo se captura
    solo lo que ya hubiera en la máquina.

    LO QUE SÍ SALE DEL EQUIPO DE QUIEN LAS GENERA
    Los procesos y los servicios son los de verdad: la lista enseña el script y la carpeta
    de cada proceso de desarrollo abierto, y Servicios, los motores instalados. Conviene
    mirar las imágenes antes de publicarlas.

.PARAMETER OutDir
    Carpeta de salida. Por defecto, docs/screenshots del repositorio.

.PARAMETER Port
    Puerto de depuración de WebView2. Por defecto 9222.

.PARAMETER LaunchTimeoutSec
    Espera máxima a que la app arranque. La primera compilación de Rust puede tardar
    varios minutos; con el target caliente son segundos.

.PARAMETER SettleSec
    Espera tras cargar la ventana antes de capturar. sysinfo necesita tres muestras para
    dar un porcentaje de CPU real: capturar antes deja toda la columna a 0,0 %.

.PARAMETER SkipDemo
    No levanta los servidores Node de demostración; captura lo que ya haya en la máquina.

.PARAMETER KeepRunning
    No cierra la copia al terminar, ni borra su carpeta de datos. Sigue con el puerto de
    depuración abierto: ciérrala a mano cuando acabes de mirarla.

.EXAMPLE
    .\tools\capture-screenshots.ps1
    .\tools\capture-screenshots.ps1 -OutDir docs\screenshots -SettleSec 15
#>
[CmdletBinding()]
param(
    [string]$OutDir,
    [int]$Port = 9222,
    [int]$LaunchTimeoutSec = 420,
    [int]$SettleSec = 8,
    [switch]$SkipDemo,
    [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"

function Info($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[!] $m"  -ForegroundColor Yellow }

# Ancho fijo de todas las capturas. Coincide con el ancho por defecto de la ventana en
# tauri.conf.json, así que lo que se ve es la app tal y como arranca.
$ANCHO   = 1000
$ALTO    = 640
$ESCALA  = 2

# ── CDP: descubrimiento y sesión ─────────────────────────────────────────────────────

function Get-CdpPagina([int]$puerto) {
    try {
        $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$puerto/json" -TimeoutSec 3
    } catch {
        return $null
    }
    return $targets |
        Where-Object { $_.type -eq "page" -and $_.webSocketDebuggerUrl } |
        Select-Object -First 1
}

function Connect-Cdp([string]$url) {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ws.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(30)
    # Sin Out-Null, el VoidTaskResult del await se cuela en la salida de la función y
    # `return $ws` acaba devolviendo un array de dos elementos.
    $ws.ConnectAsync([Uri]$url, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    return $ws
}

function Read-CdpFrame($ws) {
    # Una captura a x2 viaja en base64 y ocupa megas: llega troceada en varios frames y
    # hay que concatenar hasta EndOfMessage.
    $buffer = New-Object byte[] 131072
    $sb = New-Object Text.StringBuilder
    do {
        $seg = [ArraySegment[byte]]::new($buffer)
        $res = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        [void]$sb.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $res.Count))
    } while (-not $res.EndOfMessage)
    return $sb.ToString()
}

$script:cdpId = 0

function Invoke-Cdp($ws, [string]$metodo, $parametros) {
    $script:cdpId++
    $mio = $script:cdpId

    $mensaje = @{ id = $mio; method = $metodo }
    if ($parametros) { $mensaje.params = $parametros }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($mensaje | ConvertTo-Json -Depth 12 -Compress))

    $ws.SendAsync(
        [ArraySegment[byte]]::new($bytes),
        [Net.WebSockets.WebSocketMessageType]::Text,
        $true,
        [Threading.CancellationToken]::None
    ).GetAwaiter().GetResult() | Out-Null

    # Por el mismo socket llegan los eventos del navegador, que no llevan "id": se
    # descartan hasta dar con la respuesta a ESTA petición.
    while ($true) {
        $obj = Read-CdpFrame $ws | ConvertFrom-Json
        if ($obj.id -ne $mio) { continue }
        if ($obj.error) { throw "CDP $metodo devolvió error: $($obj.error.message)" }
        return $obj.result
    }
}

function Invoke-Js($ws, [string]$expresion) {
    $r = Invoke-Cdp $ws "Runtime.evaluate" @{
        expression    = $expresion
        returnByValue = $true
        awaitPromise  = $true
    }
    if ($r.exceptionDetails) {
        $detalle = $r.exceptionDetails.exception.description
        if (-not $detalle) { $detalle = $r.exceptionDetails.text }
        throw "La evaluación de JS falló: $detalle"
    }
    return $r.result.value
}

# ── Conducción de la interfaz ────────────────────────────────────────────────────────

<#
    Pulsa un botón buscándolo por su texto exacto.

    Se usa `element.click()` en vez de coordenadas a propósito: React responde igual a un
    click sintético, y así no hay que acertarle a un botón que puede estar por debajo del
    área visible — el fallo que costó una sesión al verificar la sección "Acerca de".
#>
function Invoke-Boton($ws, [string]$texto) {
    # Primero coincidencia exacta y solo despues por prefijo: desde que el sidebar
    # es plegable, "Procesos" lleva el total al lado cuando sus filtros no estan
    # a la vista, y el texto exacto pasa a ser "Procesos13". Buscando solo por
    # prefijo se correria el riesgo de acertar otro boton que empiece igual.
    $js = @"
(() => {
  const bs = Array.from(document.querySelectorAll('button'));
  const t = '$texto';
  const b = bs.find(x => x.textContent.trim() === t)
         || bs.find(x => x.textContent.trim().startsWith(t));
  if (!b) return false;
  b.scrollIntoView({ block: 'center' });
  b.click();
  return true;
})()
"@
    if (-not (Invoke-Js $ws $js)) { throw "No se encontró el botón '$texto' en la interfaz." }
    Start-Sleep -Milliseconds 450
}

function Set-Viewport($ws, [int]$alto) {
    try {
        # Limpiar antes de volver a fijar: encadenar dos overrides, sobre todo al pasar de
        # uno alto a uno bajo, deja el viewport con el tamaño anterior.
        Invoke-Cdp $ws "Emulation.clearDeviceMetricsOverride" | Out-Null
        Invoke-Cdp $ws "Emulation.setDeviceMetricsOverride" @{
            width             = $ANCHO
            height            = $alto
            deviceScaleFactor = $ESCALA
            mobile            = $false
        } | Out-Null
        Start-Sleep -Milliseconds 500
        return $true
    } catch {
        Warn "No se pudo fijar el tamaño del viewport: $($_.Exception.Message)"
        Warn "Se captura al tamaño natural de la ventana."
        return $false
    }
}

function Save-Captura($ws, [string]$ruta) {
    $r = Invoke-Cdp $ws "Page.captureScreenshot" @{ format = "png" }
    [IO.File]::WriteAllBytes($ruta, [Convert]::FromBase64String($r.data))
    $kb = [Math]::Round((Get-Item $ruta).Length / 1KB)
    Ok "$(Split-Path $ruta -Leaf) ($kb KB)"
}

<#
    Abre el menú contextual sobre una fila de la tabla.

    Se prefiere una fila CON puerto: su menú trae las cinco opciones, incluida "Copiar
    http://localhost:PUERTO", que es justo la que explica para qué sirve la app.
#>
function Open-MenuContextual($ws) {
    $punto = Invoke-Js $ws @'
(() => {
  const filas = Array.from(document.querySelectorAll('tbody tr'));
  if (filas.length === 0) return null;
  const conPuerto = filas.find(f => f.querySelector('td:nth-child(3) span.font-mono'));
  const fila = conPuerto || filas[0];
  fila.scrollIntoView({ block: 'center' });
  const r = fila.getBoundingClientRect();
  return { x: Math.round(r.left + 220), y: Math.round(r.top + r.height / 2) };
})()
'@
    if (-not $punto) { throw "La tabla está vacía: no hay ninguna fila sobre la que abrir el menú." }

    foreach ($evento in @(
        @{ type = "mouseMoved";    buttons = 0 },
        @{ type = "mousePressed";  buttons = 2 },
        @{ type = "mouseReleased"; buttons = 0 }
    )) {
        Invoke-Cdp $ws "Input.dispatchMouseEvent" @{
            type       = $evento.type
            x          = $punto.x
            y          = $punto.y
            button     = "right"
            buttons    = $evento.buttons
            clickCount = 1
        } | Out-Null
    }

    # Base UI abre el popup con animación; se espera a que exista de verdad.
    $abierto = $false
    foreach ($intento in 1..20) {
        Start-Sleep -Milliseconds 150
        if (Invoke-Js $ws '!!document.querySelector(''[data-slot="context-menu-content"]'')') {
            $abierto = $true
            break
        }
    }

    if (-not $abierto) {
        # Reserva por si el evento de ratón sintético no acaba en un `contextmenu`.
        Warn "El clic derecho no abrió el menú; se prueba con un evento de JS."
        Invoke-Js $ws @'
(() => {
  const filas = Array.from(document.querySelectorAll('tbody tr'));
  const conPuerto = filas.find(f => f.querySelector('td:nth-child(3) span.font-mono'));
  const fila = conPuerto || filas[0];
  const r = fila.getBoundingClientRect();
  fila.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: Math.round(r.left + 220),
    clientY: Math.round(r.top + r.height / 2),
  }));
  return true;
})()
'@ | Out-Null
        Start-Sleep -Milliseconds 600
        if (-not (Invoke-Js $ws '!!document.querySelector(''[data-slot="context-menu-content"]'')')) {
            throw "No se pudo abrir el menú contextual."
        }
    }

    Start-Sleep -Milliseconds 400   # que termine la animación de entrada
}

<#
    Levanta un servidor Node de verdad, para que la columna de puertos tenga algo que
    enseñar. No se simula nada: es un proceso node.exe escuchando en el puerto.

    Uno de los dos hace trabajo a rachas porque, sin nada consumiendo CPU, todas las barras
    salen a cero y la columna parece estropeada.
#>
function Start-Demo([int]$puerto, [switch]$conCarga) {
    if (Get-NetTCPConnection -State Listen -LocalPort $puerto -ErrorAction SilentlyContinue) {
        Warn "El puerto $puerto ya está ocupado; se deja como está."
        return $null
    }

    $codigo = "require('http').createServer((_,res)=>res.end('demo')).listen($puerto);"
    if ($conCarga) {
        # 45 ms de trabajo cada 120: un pico visible en la barra, sin calentar el equipo.
        $codigo += "setInterval(()=>{const t=Date.now();while(Date.now()-t<45){}},120);"
    }

    # Las comillas van a mano: Start-Process une los argumentos con espacios y no
    # entrecomilla nada, así que un `const t=...` llega a node partido por la mitad y
    # muere con "Unexpected end of input". El código solo lleva comillas simples.
    $p = Start-Process -FilePath "node" -ArgumentList "-e", "`"$codigo`"" `
                       -PassThru -WindowStyle Hidden
    Start-Sleep -Milliseconds 700
    if ($p.HasExited) {
        Warn "El servidor de demostración del puerto $puerto no llegó a arrancar."
        return $null
    }
    Ok "Servidor de demostración en el puerto $puerto (PID $($p.Id))."
    return $p
}

function Close-Popup($ws) {
    foreach ($tipo in @("keyDown", "keyUp")) {
        Invoke-Cdp $ws "Input.dispatchKeyEvent" @{
            type                  = $tipo
            key                   = "Escape"
            code                  = "Escape"
            windowsVirtualKeyCode = 27
            nativeVirtualKeyCode  = 27
        } | Out-Null
    }
    # El ratón sintético se queda donde abrió el menú, y la fila de debajo sigue resaltada en
    # las capturas siguientes, con su Kill en rojo. Se aparta a la esquina del título.
    Invoke-Cdp $ws "Input.dispatchMouseEvent" @{ type = "mouseMoved"; x = 2; y = 2; buttons = 0 } | Out-Null
    Start-Sleep -Milliseconds 400
}

# ── Programa ─────────────────────────────────────────────────────────────────────────

$raiz = Split-Path $PSScriptRoot -Parent
if (-not $OutDir) { $OutDir = Join-Path $raiz "docs\screenshots" }
if (-not [IO.Path]::IsPathRooted($OutDir)) { $OutDir = Join-Path $raiz $OutDir }

# El identificador de la copia. Distinto del de la app y del de las pruebas en marcha
# (`.envivo`), que borran su carpeta al empezar: con el mismo, lanzar las dos cosas a la vez
# dejaría a una sin ajustes a media sesión.
$IDENTIFICADOR = "com.processdevkill.app.capturas"
$datos       = Join-Path $env:APPDATA $IDENTIFICADOR
$webview     = Join-Path $env:LOCALAPPDATA $IDENTIFICADOR

# Los ajustes con los que salen las capturas, iguales las genere quien las genere. En español
# porque el README lo está; con un vigilado y un protegido para que esas secciones no salgan
# vacías; y sin la consulta a GitHub del arranque, que aquí solo podría poner un aviso de
# «versión disponible» encima de la lista.
$AJUSTES = '{"customNames":["docker"],"protected":["mi-api"],"language":"es","theme":"dark","checkUpdatesOnStart":false}'

$configPath  = Join-Path $raiz "src-tauri\tauri.conf.json"
$configCopia = Join-Path ([IO.Path]::GetTempPath()) "pdk-capturas-$PID.json"
$sinBom      = New-Object Text.UTF8Encoding($false)
$lanzado     = $null
$demos       = @()
$ws          = $null
$codigo      = 0

try {
    if (-not (Test-Path $configPath)) {
        throw "No se encontró $configPath. ¿Se está ejecutando desde el repositorio?"
    }

    # Si el puerto ya contesta, lo que hay detrás no es la copia de este script: puede ser la
    # app del usuario, abierta a mano con el puerto, y conducirla sería cambiarle sus ajustes.
    if (Get-CdpPagina $Port) {
        throw ("Ya hay algo escuchando en el puerto de depuración $Port. Ciérralo, o elige " +
               "otro con -Port: este script solo conduce la copia que lanza él.")
    }

    if (-not $SkipDemo) {
        Info "Levantando los servidores de demostración."
        $demos = @(
            Start-Demo 3000
            Start-Demo 8080 -conCarga
        ) | Where-Object { $_ }
    }

    Info "Preparando la copia de la app ($IDENTIFICADOR)."
    foreach ($dir in @($datos, $webview)) {
        if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    }
    New-Item -ItemType Directory -Path $datos -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $datos "settings.json"), $AJUSTES, $sinBom)

    # Un `--config` no mezcla listas, las sustituye: la ventana va entera, con lo suyo más el
    # puerto. El primer argumento es el que pone Tauri por su cuenta, y hay que repetirlo.
    $cfg = [IO.File]::ReadAllText($configPath) | ConvertFrom-Json
    $ventana = $cfg.app.windows[0]
    $ventana | Add-Member -NotePropertyName additionalBrowserArgs -Force -NotePropertyValue (
        "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection " +
        "--remote-debugging-port=$Port")
    $cambios = @{ identifier = $IDENTIFICADOR; app = @{ windows = @($ventana) } }
    [IO.File]::WriteAllText($configCopia, ($cambios | ConvertTo-Json -Depth 20), $sinBom)

    Info "Lanzando 'npm run tauri dev' con esa configuración. La primera compilación puede tardar."
    $lanzado = Start-Process -FilePath "npm.cmd" -PassThru -WorkingDirectory $raiz `
        -ArgumentList "run", "tauri", "dev", "--", "--config", "`"$configCopia`""

    $pagina = $null
    $limite = (Get-Date).AddSeconds($LaunchTimeoutSec)
    while (-not $pagina -and (Get-Date) -lt $limite) {
        if ($lanzado.HasExited) { throw "La sesión de desarrollo terminó antes de abrir la ventana." }
        Start-Sleep -Seconds 2
        $pagina = Get-CdpPagina $Port
    }
    if (-not $pagina) { throw "La app no abrió el puerto $Port en $LaunchTimeoutSec s." }

    Ok "Ventana encontrada: $($pagina.url)"
    $ws = Connect-Cdp $pagina.webSocketDebuggerUrl

    # El puerto contesta antes de que la página haya cargado: con el target caliente, la ventana
    # aparece mientras Vite todavía sirve el primer módulo, y Tauri aún no ha puesto su puente.
    $limite = (Get-Date).AddSeconds(60)
    while (-not (Invoke-Js $ws "typeof window.__TAURI_INTERNALS__?.invoke === 'function'")) {
        if ((Get-Date) -gt $limite) { throw "La ventana abrió, pero la app no terminó de cargar en 60 s." }
        Start-Sleep -Milliseconds 500
    }

    # La prueba de que es la copia y no otra cosa: sus ajustes son los que se acaban de escribir.
    $leidos =Invoke-Js $ws "window.__TAURI_INTERNALS__.invoke('get_settings')"
    if (($leidos.protected -join ",") -ne "mi-api" -or $leidos.language -ne "es") {
        throw "La ventana del puerto $Port no es la copia de las capturas: sus ajustes son otros."
    }

    Info "Esperando a que la lista tenga datos."
    $limite = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $limite) {
        if (Invoke-Js $ws "document.querySelectorAll('tbody tr').length > 0") { break }
        Start-Sleep -Seconds 1
    }
    $filas = Invoke-Js $ws "document.querySelectorAll('tbody tr').length"
    if (-not $filas) {
        Warn "La tabla está vacía. Levanta algún servidor de desarrollo y repite: una captura sin procesos no cuenta como captura."
    }

    # Las tres primeras muestras de sysinfo no dan un porcentaje real; capturar antes de
    # tiempo deja la columna de CPU entera a 0,0 %.
    Info "Dejando que la CPU se estabilice ($SettleSec s)."
    Start-Sleep -Seconds $SettleSec

    if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    Set-Viewport $ws $ALTO | Out-Null

    # Ordenar por PUERTO antes de capturar, y no es cosmético: la columna de puertos es lo
    # que justifica la app, y de fábrica la lista llega por RAM descendente, así que los
    # servidores de demostración —que son pequeños— se hunden por debajo del corte en
    # cuanto la máquina tiene unos cuantos `node` sueltos. Pasó: la captura salió con un
    # solo puerto visible y trece guiones. Ordenando por puerto, los que ocupan alguno
    # suben arriba (los que no, van siempre al final) y la captura sale igual la genere
    # quien la genere, con dos procesos node de más o de menos.
    Info "Ordenando por puerto para que la columna que justifica la app salga llena."
    Invoke-Boton $ws "Puerto"

    # Los botones se buscan por su texto en español, y es seguro: el idioma lo ponen los
    # ajustes de arriba, no el equipo. El tema arranca en oscuro por lo mismo.
    Info "Capturando la lista en tema oscuro."
    Save-Captura $ws (Join-Path $OutDir "procesos-oscuro.png")

    Info "Capturando el menú contextual."
    Open-MenuContextual $ws
    Save-Captura $ws (Join-Path $OutDir "menu-contextual.png")
    Close-Popup $ws

    # Servicios lee el catálogo del SCM al abrirse (no lo empuja el poller), así que se espera a
    # que la tabla tenga filas en vez de dar un tiempo fijo. Sale con los servicios reales del
    # equipo que genere la captura: no hay forma de simularlos sin mentir.
    Info "Capturando la vista de Servicios."
    Invoke-Boton $ws "Servicios"
    $limite = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $limite) {
        if (Invoke-Js $ws "document.querySelectorAll('main tbody tr').length > 0") { break }
        Start-Sleep -Milliseconds 500
    }
    Save-Captura $ws (Join-Path $OutDir "servicios.png")
    Invoke-Boton $ws "Procesos"

    Info "Capturando la lista en tema claro."
    Invoke-Boton $ws "Ajustes"
    Invoke-Boton $ws "Claro"
    Invoke-Boton $ws "Procesos"
    Save-Captura $ws (Join-Path $OutDir "procesos-claro.png")

    # La de Ajustes va la última porque es la única que agranda el viewport: así el resto
    # se capturan siempre al tamaño de ventana por defecto, sin depender de que el
    # emulador encoja bien.
    Info "Capturando la vista de Ajustes."
    Invoke-Boton $ws "Ajustes"
    Invoke-Boton $ws "Oscuro"
    # Ajustes no cabe en ninguna ventana razonable: desde el Tier 11 mide unos 2500 px, en cinco
    # grupos. Lo que enseña la captura son las funciones que la app añade —los vigilados, los
    # protegidos, el Auto-Kill y el Zombie Finder—, así que va del grupo «Vigilancia» al final
    # de «Actualizaciones». Idioma y tema, arriba, no le dicen nada a quien lee el README; y
    # «Acerca de», abajo, enseñaría la ruta del log de la copia, que no es la de nadie. La app
    # es redimensionable: sigue siendo una ventana posible.
    #
    # Los grupos se cuentan por su posición (el 2.º y el 5.º `h3`), no por su rótulo.
    # El scroll lo lleva el cuerpo de la vista (`ViewBody`), no `main > div` ni la página.
    $js = @'
(() => {
  const cuerpo = document.querySelector('main .overflow-y-auto');
  const grupos = Array.from(cuerpo.querySelectorAll('h3'));
  if (grupos.length < 5) return null;
  const arriba = cuerpo.getBoundingClientRect().top;
  cuerpo.scrollTop += grupos[1].getBoundingClientRect().top - arriba - 16;
  return Math.ceil(grupos[4].getBoundingClientRect().top - 24);
})()
'@
    $alto = Invoke-Js $ws $js
    if (-not $alto) { throw "Ajustes no tiene los cinco grupos que esta captura espera." }
    $alto = [Math]::Min(1600, [Math]::Max($ALTO, [int]$alto))
    Set-Viewport $ws $alto | Out-Null
    # Cambiar el viewport puede recolocar el scroll: se vuelve a llevar el grupo arriba.
    Invoke-Js $ws $js | Out-Null
    Start-Sleep -Milliseconds 300
    Save-Captura $ws (Join-Path $OutDir "ajustes.png")

    Ok "Capturas en $OutDir"
} catch {
    Write-Host "[X] $($_.Exception.Message)" -ForegroundColor Red
    $codigo = 1
} finally {
    if ($ws) { try { $ws.Dispose() } catch { } }

    if ($lanzado -and -not $KeepRunning) {
        Info "Cerrando la copia."
        & taskkill /PID $($lanzado.Id) /T /F 2>&1 | Out-Null
        Start-Sleep -Seconds 2
    }

    foreach ($demo in $demos) {
        if (-not $demo.HasExited) {
            Stop-Process -Id $demo.Id -Force -ErrorAction SilentlyContinue
            Ok "Servidor de demostración $($demo.Id) cerrado."
        }
    }

    if ($KeepRunning -and $lanzado) {
        Warn "Con -KeepRunning la copia sigue abierta, con el puerto $Port y su carpeta en $datos."
    } else {
        Remove-Item $configCopia -Force -ErrorAction SilentlyContinue
        # WebView2 tarda un momento en soltar su carpeta después de morir quien la abrió.
        foreach ($dir in @($datos, $webview)) {
            foreach ($intento in 1..10) {
                if (-not (Test-Path $dir)) { break }
                Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
                if (Test-Path $dir) { Start-Sleep -Milliseconds 400 }
            }
            if (Test-Path $dir) { Warn "No se pudo borrar $dir. Es de la copia: se puede borrar a mano." }
        }
    }
}

exit $codigo
