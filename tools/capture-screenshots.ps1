<#
.SYNOPSIS
    Regenera las capturas del README conduciendo la app de verdad.

.DESCRIPTION
    Lanza ProcessDevKill en modo desarrollo con el puerto de depuración de WebView2
    abierto, se conecta por CDP, mueve la interfaz (tema, menú contextual, vista de
    Ajustes) y guarda un PNG de cada estado en docs/screenshots/.

    Las imágenes salen del propio webview (`Page.captureScreenshot`), no de la pantalla:
    no llevan barra de título ni fondo de escritorio, y miden siempre lo mismo gracias a
    `Emulation.setDeviceMetricsOverride`, sin importar la resolución ni el escalado de
    Windows del equipo que las genere. Se capturan a x2 para que se vean nítidas en
    pantallas HiDPI y en el zoom de GitHub.

    POR QUÉ SE TOCA tauri.conf.json
    El puerto de depuración solo se puede pedir por `additionalBrowserArgs`. La variable
    de entorno WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS no vale: Tauri la sobrescribe. El
    script guarda los bytes originales del archivo y los restaura al terminar, pase lo que
    pase; ese argumento NO debe llegar a producción. El valor que se escribe conserva
    además los argumentos por defecto de Tauri, porque `additionalBrowserArgs` los
    sustituye en bloque en vez de añadirse a ellos: sin eso, el webview de las capturas no
    se comportaría como el de la app publicada.

    LO QUE ESTE MÉTODO NO PUEDE CAPTURAR
    Todo lo que dibuje Windows por encima del webview: el menú de la bandeja y las
    notificaciones nativas. Los toast de la app sí salen, porque son HTML (Sonner). Para lo
    nativo no hay atajo — `Graphics.CopyFromScreen` tampoco los recoge, se probó y salen
    capturas vacías (CONTEXT.md §3): o lo fotografía una persona, o no sale.

    LOS SERVIDORES DE DEMOSTRACIÓN
    La columna de puertos es la razón de ser de la app, así que una captura sin ningún
    puerto ocupado no sirve de nada. El script levanta dos servidores Node de verdad
    (3000 y 8080) mientras dura la sesión y los cierra al terminar; uno de ellos hace algo
    de trabajo para que las barras de CPU no salgan todas a cero. Con -SkipDemo se captura
    solo lo que ya hubiera en la máquina.

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
    No cierra la sesión de `tauri dev` al terminar. Ojo: la configuración se restaura
    igualmente, y eso hace que Tauri reinicie la app una vez, ya sin puerto de depuración.

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
    $js = @"
(() => {
  const b = Array.from(document.querySelectorAll('button'))
    .find(x => x.textContent.trim() === '$texto');
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
    Start-Sleep -Milliseconds 400
}

# ── Programa ─────────────────────────────────────────────────────────────────────────

$raiz = Split-Path $PSScriptRoot -Parent
if (-not $OutDir) { $OutDir = Join-Path $raiz "docs\screenshots" }
if (-not [IO.Path]::IsPathRooted($OutDir)) { $OutDir = Join-Path $raiz $OutDir }

$configPath  = Join-Path $raiz "src-tauri\tauri.conf.json"
$configBytes = $null
$lanzado     = $null
$demos       = @()
$ws          = $null
$temaOriginal = $null
$etiquetas   = @{ system = "Sistema"; light = "Claro"; dark = "Oscuro" }
$codigo      = 0

try {
    if (-not (Test-Path $configPath)) {
        throw "No se encontró $configPath. ¿Se está ejecutando desde el repositorio?"
    }

    if (-not $SkipDemo) {
        Info "Levantando los servidores de demostración."
        $demos = @(
            Start-Demo 3000
            Start-Demo 8080 -conCarga
        ) | Where-Object { $_ }
    }

    $yaAbierta = Get-CdpPagina $Port
    if ($yaAbierta) {
        Info "Hay una app escuchando ya en el puerto $Port; se usa esa."
    } else {
        if (Get-Process -Name "processdevkill" -ErrorAction SilentlyContinue) {
            throw ("Hay una instancia de ProcessDevKill abierta sin puerto de depuración. " +
                   "Ciérrala (incluido el icono de la bandeja) y vuelve a ejecutar el script.")
        }

        Info "Abriendo el puerto de depuración en tauri.conf.json (temporal)."
        $configBytes = [IO.File]::ReadAllBytes($configPath)
        $cfg = [Text.Encoding]::UTF8.GetString($configBytes) | ConvertFrom-Json
        # El primero es el que pone Tauri por su cuenta; `additionalBrowserArgs` sustituye
        # los argumentos por defecto en bloque, así que hay que repetirlo.
        $argumentos = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection " +
                      "--remote-debugging-port=$Port"
        $cfg.app.windows[0] |
            Add-Member -NotePropertyName additionalBrowserArgs -NotePropertyValue $argumentos -Force
        [IO.File]::WriteAllText(
            $configPath,
            ($cfg | ConvertTo-Json -Depth 20),
            (New-Object Text.UTF8Encoding($false))
        )

        Info "Lanzando 'npm run tauri dev'. La primera compilación puede tardar."
        $lanzado = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "tauri", "dev" `
                                 -WorkingDirectory $raiz -PassThru

        $limite = (Get-Date).AddSeconds($LaunchTimeoutSec)
        while (-not $yaAbierta -and (Get-Date) -lt $limite) {
            if ($lanzado.HasExited) { throw "La sesión de desarrollo terminó antes de abrir la ventana." }
            Start-Sleep -Seconds 2
            $yaAbierta = Get-CdpPagina $Port
        }
        if (-not $yaAbierta) { throw "La app no abrió el puerto $Port en $LaunchTimeoutSec s." }
    }

    Ok "Ventana encontrada: $($yaAbierta.url)"
    $ws = Connect-Cdp $yaAbierta.webSocketDebuggerUrl

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

    # El tema es un ajuste del usuario y estas capturas lo cambian dos veces: se anota para
    # devolverlo tal y como estaba.
    $temaOriginal = (Invoke-Js $ws "window.__TAURI_INTERNALS__.invoke('get_settings')").theme

    Info "Capturando la lista en tema oscuro."
    Invoke-Boton $ws "Ajustes"
    Invoke-Boton $ws "Oscuro"
    Invoke-Boton $ws "Procesos"
    Save-Captura $ws (Join-Path $OutDir "procesos-oscuro.png")

    Info "Capturando el menú contextual."
    Open-MenuContextual $ws
    Save-Captura $ws (Join-Path $OutDir "menu-contextual.png")
    Close-Popup $ws

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
    # Ajustes no cabe en 640 px y las dos funciones estrella (Auto-Kill y Zombie Finder)
    # quedarían fuera: se mide el contenido y se captura una ventana tan alta como haga
    # falta. La app es redimensionable, así que sigue siendo una ventana posible.
    $alto = Invoke-Js $ws "Math.ceil(document.querySelector('main > div').scrollHeight)"
    $alto = [Math]::Min(1400, [Math]::Max($ALTO, [int]$alto))
    Set-Viewport $ws $alto | Out-Null
    Save-Captura $ws (Join-Path $OutDir "ajustes.png")

    Ok "Capturas en $OutDir"
} catch {
    Write-Host "[X] $($_.Exception.Message)" -ForegroundColor Red
    $codigo = 1
} finally {
    if ($ws -and $ws.State -eq [Net.WebSockets.WebSocketState]::Open) {
        try {
            if ($temaOriginal -and $etiquetas[$temaOriginal]) {
                Info "Devolviendo el tema a '$($etiquetas[$temaOriginal])'."
                Invoke-Boton $ws "Ajustes"
                Invoke-Boton $ws $etiquetas[$temaOriginal]
                Invoke-Boton $ws "Procesos"
            }
            Invoke-Cdp $ws "Emulation.clearDeviceMetricsOverride" @{} | Out-Null
        } catch {
            Warn "No se pudo dejar la app como estaba: $($_.Exception.Message)"
        }
        try { $ws.Dispose() } catch { }
    }

    # Primero se cierra la app y después se restaura el archivo: al revés, Tauri detecta el
    # cambio en tauri.conf.json y reinicia la app en mitad de la limpieza.
    if ($lanzado -and -not $KeepRunning) {
        Info "Cerrando la sesión de desarrollo."
        & taskkill /PID $($lanzado.Id) /T /F 2>&1 | Out-Null
        Start-Sleep -Seconds 1
    }

    foreach ($demo in $demos) {
        if (-not $demo.HasExited) {
            Stop-Process -Id $demo.Id -Force -ErrorAction SilentlyContinue
            Ok "Servidor de demostración $($demo.Id) cerrado."
        }
    }

    if ($configBytes) {
        [IO.File]::WriteAllBytes($configPath, $configBytes)
        Ok "tauri.conf.json restaurado (sin puerto de depuración)."
        if ($KeepRunning) {
            Warn "Con -KeepRunning la app sigue abierta, pero Tauri la reiniciará al ver el cambio y ya no tendrá puerto de depuración."
        }
    }
}

exit $codigo
