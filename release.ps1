<#
.SYNOPSIS
    Corta una versión de ProcessDevKill de principio a fin.

.DESCRIPTION
    Flujo completo en un paso:
      1. Valida la versión y el árbol de trabajo, y saca las notas del release de la sección
         `## [X.Y.Z]` de CHANGELOG.md, y las mismas en inglés de CHANGELOG.en.md. Sin esas dos
         secciones no hay corte.
      2. Ejecuta las comprobaciones (salvo -SkipTests): `cargo test`, `cargo clippy`, `cargo audit`,
         `npm audit --omit=dev`, `npm run lint`, `npm test`, `npm run build` y, al final, **las
         pruebas con la app en marcha** (`tools\prueba-en-marcha.mjs`): compila una copia aparte,
         con su propio identificador, la arranca y la conduce. También en -DryRun. Entre medias
         comprueba que `THIRD-PARTY-NOTICES.txt` es el de las dependencias de ahora.
      3. Actualiza la versión en los TRES sitios donde vive.
      4. Compila los instaladores con `npm run tauri build` (NSIS + MSI).
      5. Genera el .sha256 de cada instalador — con el que la app verifica la actualización.
      6. Commit del bump de versión + tag anotado vX.Y.Z.
      7. Push de la rama y el tag a origin.
      8. Crea el GitHub Release adjuntando los instaladores y sus .sha256.
      9. Comprueba lo publicado: los 4 assets, la versión que devuelve la API que consulta la app
         y el instalador descargado contra su .sha256. Si algo no cuadra, el corte FALLA.

    Para 'gh' reutiliza la credencial de GitHub ya cacheada (la del push) si no
    estuviera autenticado; nunca se imprime el token.

    LA VERSIÓN VIVE EN TRES SITIOS y tienen que ir a la vez:
      - src-tauri/tauri.conf.json  → es la que MANDA (la que acaba en el instalador y el .exe)
      - package.json               → la del paquete npm, y arrastra a package-lock.json
      - src-tauri/Cargo.toml       → la del crate, y arrastra a Cargo.lock
    Si se tocara solo una, el instalador y el binario saldrían con versiones distintas. Tras
    cambiar Cargo.toml se corre `cargo check` para que Cargo.lock quede al día; si no, el
    commit del release deja el árbol sucio justo después de haberlo commiteado.
    package-lock.json repite la versión del paquete en sus dos primeras entradas, y se escribe
    a mano: hasta la v1.9.1 nadie lo hacía, y el archivo siguió diciendo «1.5.3» seis versiones.

    EL .sha256 NO ES CORTESÍA: ES LO QUE VERIFICA LA AUTO-ACTUALIZACIÓN.

    La app descarga el instalador del último release y lo compara con el `.sha256` que este
    script publica junto a él ANTES de ejecutarlo; si no coincide, lo borra y no instala
    nada (ver src-tauri/src/update.rs). Si un release saliera sin su `.sha256`, la app se
    negaría a actualizarse a él — que es el comportamiento correcto, pero conviene saberlo.

    Alcance honesto: el instalador y su hash salen del MISMO release, así que esto detecta
    una descarga corrupta o manipulada EN TRÁNSITO, pero no protege frente a un compromiso
    de la cuenta de GitHub, porque quien pudiera sustituir el .exe podría sustituir también
    el hash. Es el compromiso habitual de un proyecto sin certificado de firma de código.

    FIRMA DE CÓDIGO AUTHENTICODE: no la hay, Y NO LA VA A HABER (decidido el 2026-08-18).

    Es la que quitaría el aviso de SmartScreen ("editor desconocido") y la que permitiría una
    verificación fuerte de origen, pero exige un certificado de pago que el proyecto no va a
    comprar. Consecuencia para quien publique: cada release avisará de editor desconocido, y eso
    es normal, no un fallo del corte ni una detección de nada.

    Si algún día cambia la decisión, se configura con `bundle.windows.certificateThumbprint` en
    tauri.conf.json, no llamando a signtool a mano.

    Las pruebas de Rust son seguras para un corte de release: leen los procesos del sistema y
    solo matan procesos que ellas mismas lanzan. Ninguna toca los del usuario.

    SI HAY QUE REVERTIR UNA VERSIÓN MALA: NO SE PUBLICA UNA ANTERIOR.

    `is_newer` (src-tauri/src/update.rs) es ESTRICTAMENTE mayor, y eso es correcto: evita el bucle
    de reinstalación si un release se republica. Pero tiene una consecuencia que hay que saber
    antes de necesitarla: republicar la versión buena con un número anterior NO llega a nadie.
    Quien ya instaló la mala no recibe ninguna oferta de actualizar, porque para su app no hay
    nada más nuevo. Y desde la v1.3.1 la instalación es silenciosa, así que tuvo menos ocasiones
    de frenarla.

    El procedimiento, en este orden:

      1. Cortar X.Y.Z+1 con el código bueno (revertir el commit malo y volver a lanzar este
         script). Es lo único que alcanza a quien ya actualizó.
      2. Despublicar el release malo en GitHub para que deje de servirse:
             gh release delete vX.Y.Z --yes
         Con eso `/releases/latest` —que es lo que consulta la app— deja de devolverlo. Borrar
         solo los assets también vale y conserva las notas.
      3. Comprobar que la API ya devuelve la etiqueta correcta:
             gh api repos/xfiberex/ProcessDevKill/releases/latest --jq .tag_name
         Es la misma llamada que hace la app, así que responde exactamente lo que ella verá.

    El tag de git se puede dejar: es historia y no lo consulta nadie en tiempo de ejecución.

.PARAMETER Version
    Versión a publicar (X.Y.Z). Si se omite, usa la de tauri.conf.json.

.PARAMETER NotesFile
    Ruta a un archivo Markdown con las notas del release, para publicar otras que las del
    CHANGELOG. Si se omite —lo normal—, las notas son la sección `## [X.Y.Z]` de CHANGELOG.md, la
    misma sección de CHANGELOG.en.md bajo el título «English» y la tabla de descarga, y el corte
    ABORTA si alguna de las dos secciones no existe o está vacía (T12-23, T13-04).

.PARAMETER SkipTests
    Omite todas las comprobaciones del paso 2. Solo tiene sentido justo despues de un -DryRun que
    las haya pasado sobre este mismo codigo; si el arbol cambio desde entonces, se publicaria sin
    haber probado ese cambio.

    Desde 2026-08-18 eso ya no depende de recordarlo: el dry run anota el HEAD sobre el que corrio
    las comprobaciones y -SkipTests SE NIEGA a seguir si no hay marca o si HEAD es otro. Desde
    2026-09-25 anota tambien la huella de lo modificado sin commitear (T12-22), porque eso entra en
    el commit del release y el HEAD solo no lo ve.

.PARAMETER AllowDirty
    Permite continuar con cambios sin commitear: archivos sin rastrear (que NO entran en el
    release) y archivos rastreados modificados (que SI entran, por el `git add -u` del commit).

.PARAMETER DryRun
    Valida y muestra el plan, pero no modifica nada (ni build, ni git, ni GitHub).

.PARAMETER VerifyOnly
    Solo el paso 9, sobre un release que ya existe: no compila, no toca git y no publica nada. Para
    repetir la comprobación si el corte se interrumpió después de publicar, o para mirar una
    versión anterior (que fallará en «la última versión», porque ya no lo es).

.EXAMPLE
    .\release.ps1 -Version 1.0.0 -DryRun
    .\release.ps1 -Version 1.0.0
    .\release.ps1 -Version 1.0.0 -VerifyOnly
#>
[CmdletBinding()]
param(
    [string]$Version,
    [string]$NotesFile,
    [switch]$SkipTests,
    [switch]$AllowDirty,
    [switch]$DryRun,
    [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

function Info($m)  { Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)    { Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m)  { Write-Host "[!] $m" -ForegroundColor Yellow }
function Die($m)   { Write-Host "[X] $m" -ForegroundColor Red; exit 1 }

<#
.SYNOPSIS
    Archivo donde el dry run deja constancia de sobre qué commit corrió las pruebas.

.DESCRIPTION
    `-SkipTests` existe para no repetir las comprobaciones cuando un dry run acaba de pasarlas, pero
    hasta 2026-08-18 nada relacionaba las dos ejecuciones: el script no recordaba que hubiera habido
    un dry run, ni sobre qué código. Un `-SkipTests` sobre un árbol que cambió después publicaba sin
    haber probado ese cambio — y publicar es lo único que no se puede deshacer, porque `is_newer` es
    estrictamente mayor y una versión anterior ya no alcanza a quien instaló la mala.

    Va en %TEMP% y no en el repositorio a propósito: es estado de una máquina y de un momento, no
    algo que deba viajar en un commit ni ensuciar el árbol que el propio script exige limpio.
#>
function Get-DryRunMarkerPath {
    Join-Path $env:TEMP "pdk_dryrun_head.txt"
}

<#
.SYNOPSIS
    Huella SHA-256 de todo lo rastreado que difiere de HEAD, en minúsculas.

.DESCRIPTION
    El HEAD solo no basta para saber qué se probó (T12-22): el commit del release hace `git add -u`,
    así que lo modificado sin commitear también se publica. Con -AllowDirty eso puede ser código que
    ni el dry run ni la CI vieron si se tocó después.

    `--output` escribe el diff directamente a un archivo: pasarlo por la tubería de PowerShell lo
    convertiría en líneas de texto y la huella dependería de la codificación de la consola.
#>
function Get-DiffHuella {
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        if ((Invoke-Nativo git @('diff', 'HEAD', '--binary', "--output=$tmp")) -ne 0) {
            Die "No se pudo calcular el diff contra HEAD."
        }
        (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
    }
    finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}

<#
.SYNOPSIS
    Ejecuta git de forma segura cuando la salida del script está redirigida. Devuelve el código de salida.

.DESCRIPTION
    git escribe por stderr en su operación NORMAL, sin que nada haya fallado: el resumen del push
    ("To https://github.com/..."), los avisos de finales de línea ("LF will be replaced by CRLF")...

    Ejecutando el script de forma normal eso es inocuo: stderr va a la consola y sigue adelante. PERO si
    alguien captura la salida —`.\release.ps1 ... | Tee-Object release.log`, un `2>&1 |`, un wrapper que
    recoja la salida—, Windows PowerShell 5.1 convierte cada línea de stderr de un exe nativo en un
    NativeCommandError y, con $ErrorActionPreference = "Stop", ABORTA el script aunque git haya devuelto 0.

    En un `git push` eso es especialmente malo: el script muere DESPUÉS de haber empujado la rama, y deja
    el release a medias (rama subida, sin tag ni GitHub Release).

    Aquí se baja la preferencia solo mientras corre git y se decide por $LASTEXITCODE, que es el único
    indicador fiable de si git falló. La salida se sigue mostrando, atenuada.
#>
function Invoke-Git {
    $eap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git @args 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        return $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $eap }
}

<#
.SYNOPSIS
    Ejecuta un comando externo y devuelve su código de salida, sin morir por su stderr.

.DESCRIPTION
    Lo mismo que Invoke-Git, pero para cargo y npm, que también escriben por stderr sin que
    nada haya fallado. `cargo test` emite un "warning: linker stdout: Creando biblioteca..."
    en cada ejecución; `npm` avisa de vulnerabilidades y de funding.

    Ejecutando el script normalmente eso es inocuo. PERO si alguien captura la salida
    —`.\release.ps1 ... | Tee-Object release.log`, un `2>&1 |`, o un wrapper que la recoja—,
    Windows PowerShell 5.1 convierte cada línea de stderr de un exe nativo en un
    NativeCommandError y, con $ErrorActionPreference = "Stop", ABORTA el script aunque el
    comando haya devuelto 0.

    Pasó de verdad el 2026-07-26 cortando la v1.1.1: el release murió en `cargo test` con
    los 35 tests en verde, solo porque la salida estaba redirigida.

    OJO CON EL PRIMER INTENTO DE ARREGLARLO, que no funciona: pasar un scriptblock y bajar
    la preferencia dentro de la función NO sirve. Un scriptblock se evalúa con las variables
    de preferencia del ámbito donde se DEFINIÓ —el de quien llama, con "Stop"— y no con las
    del ámbito donde se invoca. Hay que ejecutar el comando aquí dentro, como hace
    Invoke-Git, y consumir su stderr en esta misma función.
#>
function Invoke-Nativo {
    param([string]$exe, [string[]]$argumentos = @())

    $eap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $exe @argumentos 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        return $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $eap }
}

<#
.SYNOPSIS
    Ejecuta un comando externo en silencio y devuelve su código de salida; -1 si el exe no existe.

.DESCRIPTION
    Para preguntar si algo está (`cargo audit --version`) o si algo es cierto (`git rev-parse`).
    La forma obvia, `& cargo audit --version *> $null`, NO sirve en PowerShell 5.1: con
    $ErrorActionPreference = "Stop", la línea de stderr de un exe nativo se convierte en un
    NativeCommandError aunque vaya a $null, y el script ABORTA justo cuando la respuesta es «no
    está». Así se rompió en silencio la regla de T2-02 —«las herramientas que faltan avisan, no
    abortan»— hasta que la re-auditoría del 2026-09-25 lo reprodujo (T12-21).

    Get-Command va primero porque, si el exe no existe, `&` no toca $LASTEXITCODE y se leería el
    código del comando anterior.
#>
function Test-Nativo {
    param([string]$exe, [string[]]$argumentos = @())

    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { return -1 }
    $eap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $exe @argumentos 2>&1 | Out-Null
        return $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $eap }
}

<#
.SYNOPSIS
    Lee un archivo de texto respetando su codificación.

.DESCRIPTION
    NO usar `Get-Content -Raw`: en PS 5.1 lee con la página de códigos ANSI del sistema, así que los
    bytes UTF-8 de un acento (é = C3 A9) se convierten en dos caracteres (Ã©) y, al reescribir el
    archivo como UTF-8, la corrupción queda GRABADA. Como el bump de versión ocurre en CADA release,
    el daño se acumula capa sobre capa. Pasó de verdad en este repo el 2026-07-24 con CONTEXT.md y
    hubo que revertir el doble encoding a mano.

    ReadAllText detecta el BOM y asume UTF-8 si no lo hay, que es justo lo que queremos.
#>
function Read-Texto($ruta) { [System.IO.File]::ReadAllText($ruta) }

<#
.SYNOPSIS
    Escribe texto como UTF-8 SIN BOM.

.DESCRIPTION
    Sin BOM a propósito: los tres archivos que toca este script (JSON y TOML) son formatos donde el
    BOM sobra y algunas herramientas se atragantan con él. La lectura de vuelta no lo necesita porque
    ReadAllText asume UTF-8 cuando no hay BOM.
#>
function Write-Texto($ruta, $texto) {
    [System.IO.File]::WriteAllText($ruta, $texto, (New-Object System.Text.UTF8Encoding($false)))
}

<#
.SYNOPSIS
    La sección `## [X.Y.Z]` de CHANGELOG.md, sin su título y con las líneas partidas vueltas a unir.
    Devuelve $null si la sección no existe o no tiene nada.

.DESCRIPTION
    Hasta la v1.8.1 las notas se escribían a mano en un archivo aparte, repitiendo lo que el
    CHANGELOG ya decía; y sin -NotesFile se publicaba una plantilla que no contaba nada (T12-23).

    HAY QUE UNIR LAS LÍNEAS. El CHANGELOG va partido a 100 columnas, y GitHub pinta cada salto de
    línea del cuerpo de un release como un salto de verdad: sin unir, cada frase saldría cortada
    donde la cortó el editor. Una línea continúa la anterior salvo que empiece algo —un elemento de
    lista, un título, una tabla, una cita— o que haya una línea en blanco en medio. Los bloques de
    código se copian tal cual.

    La sección acaba en el siguiente `## [` o en las referencias de enlaces del final del archivo
    (`[1.8.1]: https://…`), que pertenecen al CHANGELOG entero y no a la última versión.
#>
function Get-NotasDelChangelog($ruta, $version) {
    if (-not (Test-Path $ruta)) { return $null }

    $salida = New-Object System.Collections.Generic.List[string]
    $dentro = $false
    $enCodigo = $false
    # Si la última línea de $salida admite que se le pegue una continuación.
    $abierta = $false

    foreach ($linea in ((Read-Texto $ruta) -split "`r?`n")) {
        if (-not $enCodigo -and $linea -match '^## \[') {
            if ($dentro) { break }
            $dentro = $linea -match ('^## \[' + [regex]::Escape($version) + '\]')
            continue
        }
        if (-not $dentro) { continue }
        if (-not $enCodigo -and $linea -match '^\[[^\]]+\]:\s') { break }

        if ($linea.TrimStart().StartsWith('```')) {
            $enCodigo = -not $enCodigo
            $salida.Add($linea); $abierta = $false
            continue
        }
        if ($enCodigo) { $salida.Add($linea); continue }

        if ($linea.Trim() -eq '') {
            $salida.Add(''); $abierta = $false
        } elseif ($linea -match '^\s*([-*+] |\d+\. |#{1,6} |\||>)') {
            $salida.Add($linea.TrimEnd())
            # A un título o a una fila de tabla no se le pega nada; a un elemento de lista, sí.
            $abierta = $linea -match '^\s*([-*+] |\d+\. |>)'
        } elseif ($abierta) {
            $salida[$salida.Count - 1] += ' ' + $linea.Trim()
        } else {
            $salida.Add($linea.TrimEnd()); $abierta = $true
        }
    }

    $texto = ($salida -join "`n").Trim()
    if ($texto) { $texto } else { $null }
}

<#
.SYNOPSIS
    La ruta de gh, con sesión. Si gh no está autenticado, toma prestada la credencial de git.

.DESCRIPTION
    Puede escribir $env:GH_TOKEN. Quien llama lo devuelve a como estaba en su `finally`.
#>
function Get-GhAutenticado {
    $gh = @(
        "C:\Program Files\GitHub CLI\gh.exe",
        "C:\Program Files (x86)\GitHub CLI\gh.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $gh) {
        $cmd = Get-Command gh -ErrorAction SilentlyContinue
        if ($cmd) { $gh = $cmd.Source }
    }
    if (-not $gh) { return $null }

    # Si gh no está logueado, reutilizar la credencial cacheada de git (la misma del push).
    # PS 5.1: 2>$null en exes nativos con ErrorActionPreference=Stop genera NativeCommandError;
    # se baja a SilentlyContinue solo durante las llamadas que necesitan suprimir stderr.
    $eap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    & $gh auth status 2>$null | Out-Null
    $authOk = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $eap

    if (-not $authOk) {
        Warn "gh no autenticado; reutilizando la credencial de git cacheada (local, no se muestra)."
        $eap = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        $cred = "protocol=https`nhost=github.com`n`n" | & git credential fill 2>$null
        $ErrorActionPreference = $eap
        $pwdLine = $cred | Where-Object { $_ -like 'password=*' } | Select-Object -First 1
        if ($pwdLine) { $env:GH_TOKEN = $pwdLine.Substring(9) }
        if (-not $env:GH_TOKEN) { return $null }
    }
    $gh
}

<#
.SYNOPSIS
    Comprueba un release ya publicado. Devuelve la lista de lo que no cuadra; vacía si todo está bien.

.DESCRIPTION
    Lo que hasta la v1.8.1 se hacía a mano después de cada corte y se apuntaba en CONTEXT §3
    (T12-24). Son las tres cosas de las que depende que la auto-actualización funcione, miradas
    DESDE FUERA, como las verá una app instalada:

      1. Los 4 assets están. Sin el `.sha256` del instalador NSIS, la app se niega a actualizarse.
      2. `/releases/latest` devuelve este tag. Es la llamada exacta que hace la app; si devuelve
         otro, nadie recibe la oferta. Se reintenta unos segundos porque GitHub puede tardar en
         reflejar un release recién creado.
      3. El instalador DESCARGADO coincide con su `.sha256` DESCARGADO —la misma comparación que
         hace `update.rs`— y, si se pasa -HashLocal, también con el que se compiló aquí: una subida
         corrupta daría un instalador que no es el que se probó.

    No aborta: devuelve los problemas para que quien llama decida qué decir. Un corte los trata
    como fallo; -VerifyOnly sobre una versión antigua espera el segundo.
#>
function Test-ReleasePublicado {
    param([string]$gh, [string]$repo, [string]$tag, [string]$version, [string]$HashLocal)

    $problemas = New-Object System.Collections.Generic.List[string]
    $setupNombre = "ProcessDevKill_${version}_x64-setup.exe"
    $msiNombre   = "ProcessDevKill_${version}_x64_en-US.msi"
    $esperados   = @($setupNombre, "$setupNombre.sha256", $msiNombre, "$msiNombre.sha256")

    $tmp = Join-Path $env:TEMP "pdk_verificar_$version"
    $eap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        # 1. Los assets
        $assets = @(& $gh release view $tag --repo $repo --json assets --jq '.assets[].name' 2>$null)
        if ($LASTEXITCODE -ne 0) {
            $problemas.Add("No se pudo leer el release $tag de $repo.")
            return ,$problemas
        }
        foreach ($nombre in $esperados) {
            if ($assets -notcontains $nombre) { $problemas.Add("Falta el asset $nombre.") }
        }
        Info "Assets publicados: $($assets.Count)"

        # 2. Lo que ve la app
        $ultimo = $null
        for ($i = 0; $i -lt 5; $i++) {
            $ultimo = "$(& $gh api "repos/$repo/releases/latest" --jq .tag_name 2>$null)".Trim()
            if ($ultimo -eq $tag) { break }
            Start-Sleep -Seconds 3
        }
        if ($ultimo -ne $tag) {
            $problemas.Add("La API devuelve '$ultimo' como última versión, no ${tag}: las apps instaladas no verán esta.")
        }
        Info "Última versión según la API: $ultimo"

        # 3. El instalador, tal como lo descargará la app
        if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
        & $gh release download $tag --repo $repo --pattern $setupNombre --pattern "$setupNombre.sha256" --dir $tmp 2>$null | Out-Null
        $descargado = Join-Path $tmp $setupNombre
        $suHash     = Join-Path $tmp "$setupNombre.sha256"
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $descargado) -or -not (Test-Path $suHash)) {
            $problemas.Add("No se pudieron descargar el instalador y su .sha256.")
            return ,$problemas
        }
        $real      = (Get-FileHash $descargado -Algorithm SHA256).Hash.ToLower()
        $publicado = ((Read-Texto $suHash).Trim() -split '\s+')[0].ToLower()
        if ($real -ne $publicado) {
            $problemas.Add("El instalador descargado ($real) NO coincide con su .sha256 publicado ($publicado): la app se negará a instalarlo.")
        }
        if ($HashLocal -and $real -ne $HashLocal.ToLower()) {
            $problemas.Add("El instalador descargado ($real) no es el que se compiló aquí ($($HashLocal.ToLower())).")
        }
        Info "SHA-256 del instalador descargado: $real"
    }
    finally {
        $ErrorActionPreference = $eap
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
    return ,$problemas
}

<#
.SYNOPSIS
    `usuario/repositorio` a partir de la URL de origin, que es como lo piden `gh --repo` y la API.
#>
function Get-RepoDeOrigin {
    $url = "$(& git remote get-url origin)".Trim()
    if ($url -match 'github\.com[:/](.+?)(\.git)?$') { $Matches[1] } else { $null }
}

# ── Rutas ──────────────────────────────────────────────────────────────────
$root       = $PSScriptRoot
$tauriConf  = Join-Path $root "src-tauri\tauri.conf.json"
$packageJson= Join-Path $root "package.json"
$cargoToml  = Join-Path $root "src-tauri\Cargo.toml"
$bundleDir  = Join-Path $root "src-tauri\target\release\bundle"
$changelog  = Join-Path $root "CHANGELOG.md"
$changelogEn= Join-Path $root "CHANGELOG.en.md"

$packageLock= Join-Path $root "package-lock.json"
foreach ($f in @($tauriConf, $packageJson, $cargoToml)) {
    if (-not (Test-Path $f)) { Die "No se encontró $f" }
}

# Un puerto de depuración en tauri.conf.json acabaría dentro del instalador: cualquier programa del
# equipo podría conducir la app de quien la instale, y con ella cerrar sus procesos. Para
# inspeccionar la interfaz a mano hay que añadirlo ahí (ver CLAUDE.md) y es fácil olvidarse de
# quitarlo. Las pruebas en marcha no lo tocan: usan `--config` y otra carpeta de compilación.
if ((Read-Texto $tauriConf) -match 'remote-debugging-port') {
    Die "tauri.conf.json lleva un puerto de depuración (--remote-debugging-port). Quítalo antes de cortar: no puede viajar en un instalador."
}

# ── Versión ────────────────────────────────────────────────────────────────
$confRaw = Read-Texto $tauriConf
$currentVersion = $null
if ($confRaw -match '"version"\s*:\s*"([^"]+)"') { $currentVersion = $Matches[1] }

if (-not $Version) {
    if (-not $currentVersion) { Die "No hay 'version' en tauri.conf.json y no se pasó -Version." }
    $Version = $currentVersion
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Die "Versión inválida '$Version'. Usa el formato X.Y.Z (p. ej. 1.0.0)."
}
$tag = "v$Version"
if (-not $VerifyOnly) {
    Info "Versión a publicar: $Version  (tag $tag)"
    if ($currentVersion -and $currentVersion -ne $Version) {
        Info "Bump de versión: $currentVersion -> $Version"
    }
}

$setup = Join-Path $bundleDir "nsis\ProcessDevKill_${Version}_x64-setup.exe"
$msi   = Join-Path $bundleDir "msi\ProcessDevKill_${Version}_x64_en-US.msi"

# ── Validaciones de git ──────────────────────────────────────────────────────
# Valor de GH_TOKEN antes de que el script lo toque, para poder devolverlo tal cual al terminar.
# Un script de PowerShell corre en el proceso de la consola que lo lanza, asi que lo que se meta
# aqui sobrevive al script y queda a la vista de todo lo que se ejecute despues en esa terminal.
# Mas abajo puede escribirse la credencial cacheada de git, que tiene alcance `repo` y `workflow`.
# OJO: `$env:VAR = ""` BORRA la variable en vez de dejarla vacia, asi que restaurar hay que hacerlo
# distinguiendo "no existia" de "existia": ver el finally.
$ghTokenPrevio = if (Test-Path Env:\GH_TOKEN) { $env:GH_TOKEN } else { $null }
$ghTokenExistia = Test-Path Env:\GH_TOKEN

Push-Location $root
try {
    if ((Test-Nativo git @('rev-parse', '--is-inside-work-tree')) -ne 0) { Die "Este directorio no es un repositorio git." }

    $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    Info "Rama: $branch"

    # ── Solo comprobar un release que ya existe ──────────────────────────────
    # Antes de las validaciones del corte: aquí el tag TIENE que existir, y el árbol da igual.
    if ($VerifyOnly) {
        $gh = Get-GhAutenticado
        if (-not $gh) { Die "gh (GitHub CLI) no está instalado o no tiene sesión. Instálalo con 'winget install GitHub.cli' y ejecuta 'gh auth login'." }
        $repoNombre = Get-RepoDeOrigin
        if (-not $repoNombre) { Die "origin no apunta a GitHub: no se sabe qué release comprobar." }

        Info "Comprobando el release $tag de $repoNombre..."
        $problemas = Test-ReleasePublicado -gh $gh -repo $repoNombre -tag $tag -version $Version
        if ($problemas.Count -gt 0) {
            $problemas | ForEach-Object { Warn $_ }
            Die "El release $tag no cuadra."
        }
        Ok "Release $tag comprobado: los 4 assets, la versión de la API y el hash del instalador."
        return
    }

    $localTag = (& git tag --list $tag)
    if ($localTag) { Die "El tag $tag ya existe localmente. Usa otra versión o bórralo antes." }
    # El mismo problema que resuelve Test-Nativo, pero aquí hace falta la salida. Sin bajar la
    # preferencia, cualquier aviso de git por stderr abortaba el corte antes de empezar.
    $eap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { $remoteTag = (& git ls-remote --tags origin $tag 2>$null) }
    finally { $ErrorActionPreference = $eap }
    if ($remoteTag) { Die "El tag $tag ya existe en origin. Usa otra versión." }

    $estado = @(& git status --porcelain)

    # Archivos nuevos sin rastrear: NO entran en el commit del release. Se avisa y se para, porque
    # olvidarse de un `git add` aquí publica una versión a la que le falta código.
    $untracked = $estado | Where-Object { $_ -match '^\?\?' }
    if ($untracked -and -not $AllowDirty) {
        Warn "Hay archivos nuevos sin rastrear (no se incluirán en el release):"
        $untracked | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Die "Añade los que necesites con 'git add <archivo>' y reintenta, o usa -AllowDirty para ignorarlos."
    } elseif ($untracked) {
        Warn "Archivos sin rastrear ignorados (-AllowDirty):"
        $untracked | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }

    # Archivos rastreados modificados: estos SÍ entran, por el `git add -u` del commit del release,
    # y hasta 2026-09-25 pasaban sin decir nada (T12-22). Lo que se publica tiene que ser lo que
    # está en un commit que la CI ya comprobó; si no, se para.
    $modificados = $estado | Where-Object { $_ -and $_ -notmatch '^\?\?' }
    if ($modificados -and -not $AllowDirty) {
        Warn "Hay cambios sin commitear que entrarían en el commit del release:"
        $modificados | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Die "Commitéalos (y deja que pase la CI) o descártalos, y reintenta. -AllowDirty los deja entrar."
    } elseif ($modificados) {
        Warn "Cambios sin commitear que ENTRARÁN en el release (-AllowDirty):"
        $modificados | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }


    # ── Notas del release ──────────────────────────────────────────────────────
    # Antes de las pruebas, y no después como hasta la v1.8.1: si falta la sección del CHANGELOG,
    # mejor saberlo ahora que tras cinco minutos de comprobaciones.
    $notesPath = $NotesFile
    $tempNotes = $null
    if (-not $notesPath) {
        $seccion = Get-NotasDelChangelog $changelog $Version
        if (-not $seccion) {
            Die "CHANGELOG.md no tiene una sección '## [$Version]' con contenido. Pasa lo de «Sin publicar» a esa sección —con su fecha y su enlace al final del archivo— y commitéalo, o usa -NotesFile."
        }

        # Las mismas notas, en inglés (T13-04). La app enseña la mitad de su idioma: lo que va
        # antes de este título es el español, y lo que va después, hasta «Descarga», el inglés
        # (`INGLES` en src/lib/notas.ts). Si se cambia el título aquí, se cambia allí. Sin la
        # sección no hay corte: quien tiene la app en inglés leería la versión nueva en español,
        # y eso solo se nota con el release ya fuera.
        $tituloIngles = "## English"
        $seccionEn = Get-NotasDelChangelog $changelogEn $Version
        if (-not $seccionEn) {
            Die "CHANGELOG.en.md no tiene una sección '## [$Version]' con contenido. Traduce ahí la de CHANGELOG.md y commitéalo, o usa -NotesFile."
        }

        # La cola empieza por el título «Descarga» A PROPÓSITO: la app enseña las notas en Ajustes
        # hasta ese título y no más allá (`COLA` en src/lib/notas.ts). Quien las lee ahí ya tiene
        # la app instalada. Si se cambia el título aquí, se cambia allí.
        $cola = @(
            "---",
            "",
            "### Descarga",
            "",
            "| Archivo | Para qué |",
            "|---|---|",
            "| ``ProcessDevKill_${Version}_x64-setup.exe`` | Instalador recomendado (NSIS). Se instala para el usuario actual, sin pedir permisos de administrador. |",
            "| ``ProcessDevKill_${Version}_x64_en-US.msi`` | Instalador MSI, para despliegue por directiva de grupo o quien lo prefiera. |",
            "",
            "Los ``.sha256`` son el hash de cada instalador, por si quieres verificar la descarga:",
            "",
            "``````powershell",
            "Get-FileHash .\ProcessDevKill_${Version}_x64-setup.exe -Algorithm SHA256",
            "``````",
            "",
            "### Aviso de SmartScreen",
            "",
            "Los instaladores no están firmados, así que la primera vez Windows mostrará el aviso de SmartScreen (*Windows protegió su PC*): **Más información → Ejecutar de todas formas**.",
            "",
            "Requiere Windows 10/11 con WebView2 (incluido de serie en Windows 11)."
        ) -join "`n"

        # Write-Texto y no Out-File: en PowerShell 5.1, `-Encoding utf8` pone un BOM, y la app
        # enseña el cuerpo del release tal cual le llega.
        $tempNotes = Join-Path $env:TEMP "pdk_release_$Version.md"
        Write-Texto $tempNotes "$seccion`n`n$tituloIngles`n`n$seccionEn`n`n$cola`n"
        $notesPath = $tempNotes
        Ok "Notas del release tomadas de CHANGELOG.md y CHANGELOG.en.md, sección [$Version]."
    }
    if (-not (Test-Path $notesPath)) { Die "No se encontró el archivo de notas: $notesPath" }


    # ── Pruebas ──────────────────────────────────────────────────────────────
    if ($SkipTests) {
        # Se niega en vez de solo avisar: un aviso se lo lleva el scroll, y lo que hay al otro lado
        # es publicar código sin haber probado ese código. Salir de aquí cuesta quitar el
        # modificador; el error que evita no se puede deshacer.
        $marca = Get-DryRunMarkerPath
        $headActual = (& git rev-parse HEAD).Trim()

        if (-not (Test-Path $marca)) {
            Die "-SkipTests sin un dry run previo en esta maquina. Lanza el mismo comando con -DryRun primero, o quita -SkipTests."
        }

        # Línea 1: el HEAD. Línea 2: la huella de lo modificado sin commitear (T12-22). Una marca
        # de antes de 2026-09-25 no tiene la segunda y se trata como no válida.
        $lineas = @(Get-Content $marca -TotalCount 2)
        $headProbado = $lineas[0].Trim()
        if ($headProbado -ne $headActual) {
            Die "-SkipTests: el ultimo dry run corrio sobre $($headProbado.Substring(0,7)) y HEAD es $($headActual.Substring(0,7)). Ese codigo no se ha probado. Repite el dry run o quita -SkipTests."
        }
        $diffProbado = if ($lineas.Count -ge 2) { $lineas[1].Trim() } else { "" }
        if ($diffProbado -ne (Get-DiffHuella)) {
            Die "-SkipTests: los cambios sin commitear no son los que vio el ultimo dry run. Ese codigo no se ha probado. Repite el dry run o quita -SkipTests."
        }

        Warn "Pruebas omitidas (-SkipTests), ya pasadas en el dry run sobre $($headActual.Substring(0,7))."
    } else {
        Info "Ejecutando los tests de Rust..."
        # Con PDK_EXIGIR_NODE, una prueba que no puede lanzar su `node` falla en vez de saltarse y
        # contar como superada (T12-18). Igual que en la CI: un corte no se da por probado a medias.
        $exigirPrevio = $env:PDK_EXIGIR_NODE
        $env:PDK_EXIGIR_NODE = "1"
        Push-Location (Join-Path $root "src-tauri")
        try {
            if ((Invoke-Nativo cargo @('test','--quiet')) -ne 0) { Die "Los tests de Rust fallaron. Release abortado." }
        } finally {
            Pop-Location
            if ($null -eq $exigirPrevio) { Remove-Item Env:\PDK_EXIGIR_NODE -ErrorAction SilentlyContinue }
            else { $env:PDK_EXIGIR_NODE = $exigirPrevio }
        }
        Ok "Tests de Rust correctos."

        # Clippy y las auditorias de dependencias. Antes no estaban, y el arbol de Rust —567
        # entradas en Cargo.lock— no se habia contrastado NUNCA contra la base de RustSec: la
        # primera vez que se corrio, el 2026-08-18, aparecio una vulnerabilidad real (h2, DoS por
        # DATA frames vacios, publicada el dia antes). Sin este paso eso se publica sin que nadie
        # lo mencione.
        #
        # ⚠️ **Las herramientas que faltan avisan, no abortan.** El proyecto se trabaja desde
        # varios equipos y clippy o cargo-audit pueden no estar instalados en uno; que eso impida
        # cortar una version seria peor que el riesgo que cubren. Lo que si aborta es una
        # herramienta presente que encuentra algo.
        Push-Location (Join-Path $root "src-tauri")
        try {
            # Sin esta comprobación, que falte clippy se leía como «Clippy encontró avisos».
            if ((Test-Nativo cargo @('clippy', '--version')) -ne 0) {
                Warn "clippy no esta instalado; no se pasa. Para tenerlo: rustup component add clippy"
            } else {
                Info "Pasando clippy..."
                if ((Invoke-Nativo cargo @('clippy','--all-targets','--quiet','--','-D','warnings')) -ne 0) {
                    Die "Clippy encontro avisos. Release abortado."
                }
                Ok "Clippy limpio."
            }

            # `cargo audit` sale con 0 aunque haya avisos de crates sin mantener (18 hoy, casi
            # todos bindings de GTK que en Windows ni se compilan) y con 1 si hay vulnerabilidad.
            if ((Test-Nativo cargo @('audit', '--version')) -ne 0) {
                Warn "cargo-audit no esta instalado; no se auditan los crates. Para tenerlo: cargo install cargo-audit --locked"
            } elseif ((Invoke-Nativo cargo @('audit')) -ne 0) {
                Die "cargo audit encontro una vulnerabilidad. Release abortado."
            } else {
                Ok "Crates de Rust sin vulnerabilidades conocidas."
            }
        } finally { Pop-Location }

        # Solo el arbol de produccion: las herramientas de compilacion no viajan en el instalador,
        # y bloquear un release por un aviso de algo que solo corre en esta maquina es ruido. Con
        # `shadcn` movido a devDependencies (2026-08-18) este arbol esta a cero.
        Info "Auditando las dependencias npm de produccion..."
        if ((Invoke-Nativo npm @('audit','--omit=dev','--audit-level=high')) -ne 0) {
            Die "npm audit encontro vulnerabilidades en dependencias de produccion. Release abortado."
        }
        Ok "Dependencias npm de produccion sin vulnerabilidades altas."

        # ESLint: el equivalente de clippy en el frontend, y hasta 2026-08-18 no habia ninguno.
        # Aborta, no avisa: a diferencia de clippy o cargo-audit, esto no depende de una
        # herramienta instalada en la maquina — viaja en devDependencies, asi que si falta es que
        # falta `npm install`, y entonces tampoco iban a correr los tests.
        Info "Pasando ESLint..."
        if ((Invoke-Nativo npm @('run','lint')) -ne 0) { Die "ESLint encontro problemas. Release abortado." }
        Ok "Frontend sin avisos de ESLint."

        # THIRD-PARTY-NOTICES.txt viaja DENTRO del instalador como recurso y la app enlaza a él
        # desde Ajustes: su valor entero está en ser exacto. Se quedó viejo una vez —declaraba una
        # versión de shadcn que nunca estuvo instalada y le faltaban cuatro crates que sí van en
        # el binario— porque nada relacionaba las dos cosas.
        #
        # Hasta la v1.9.0 esto comparaba FECHAS: avisaba si package.json o Cargo.lock eran más
        # recientes que el archivo. El propio corte escribe la versión en los dos, así que el
        # aviso saltaba en todos los cortes, y un aviso que siempre salta enseña a no leerlo
        # (T12-25). Ahora se compara el CONTENIDO: el generador lo rehace en memoria y dice si
        # coincide. Y ya no avisa, aborta: un «no coincide» es seguro, no una sospecha, y
        # arreglarlo es un comando.
        Info "Comprobando que los avisos de terceros son los de las dependencias de ahora..."
        if ((Invoke-Nativo node @((Join-Path $root 'tools\avisos-de-terceros.mjs'), '--comprobar')) -ne 0) {
            Die "THIRD-PARTY-NOTICES.txt no está al día. Regenéralo con 'node tools\avisos-de-terceros.mjs', revisa el cambio y commitéalo. Release abortado."
        }
        Ok "Avisos de terceros al día."

        # Pruebas del frontend (Vitest + Testing Library, Tier 6.4). Corren en jsdom con los
        # modulos de Tauri doblados, asi que no tocan procesos reales ni necesitan la ventana:
        # son seguras dentro de un corte de release, igual que las de Rust.
        Info "Ejecutando los tests del frontend..."
        if ((Invoke-Nativo npm @('test')) -ne 0) { Die "Los tests del frontend fallaron. Release abortado." }
        Ok "Tests del frontend correctos."

        # `npm run build` es `tsc && vite build`: comprueba los tipos del frontend. Vale la pena
        # aparte, aunque `tauri build` lo repita, para fallar antes de empezar a compilar Rust.
        Info "Comprobando tipos y compilando el frontend..."
        if ((Invoke-Nativo npm @('run','build')) -ne 0) { Die "El build del frontend falló. Release abortado." }
        Ok "Frontend correcto."

        # Lo último, y lo que más tarda: compila una copia de la app con su propio identificador
        # —no toca los ajustes del usuario ni su app abierta—, la arranca y comprueba que hace lo
        # que dice. Las suites prueban piezas; esto, el binario. Lo que comprueba y lo que no toca
        # está en la cabecera del guion.
        Info "Probando la app en marcha (compila una copia aparte; tarda unos minutos la primera vez)..."
        if ((Invoke-Nativo node @((Join-Path $root 'tools\prueba-en-marcha.mjs'))) -ne 0) {
            Die "Las pruebas con la app en marcha fallaron. Release abortado."
        }
        Ok "La app en marcha hace lo que dice."
    }

    # ── DRY RUN: mostrar plan y salir ────────────────────────────────────────
    if ($DryRun) {
        Write-Host ""
        Warn "DRY RUN — no se modificará nada. Plan:"
        Write-Host "    1. Poner la versión $Version en tauri.conf.json, package.json y Cargo.toml" -ForegroundColor DarkGray
        Write-Host "       + 'cargo check' para actualizar Cargo.lock, y la misma versión en package-lock.json" -ForegroundColor DarkGray
        Write-Host "    2. npm run tauri build  (NSIS + MSI, SIN firma de código:" -ForegroundColor DarkGray
        Write-Host "       SmartScreen seguirá avisando)" -ForegroundColor DarkGray
        Write-Host "    3. Generar los .sha256 — con el que la app verifica la actualización" -ForegroundColor DarkGray
        Write-Host "    4. git add -u ; git commit -m 'release: v$Version' ; git tag -a $tag" -ForegroundColor DarkGray
        Write-Host "    5. git push origin $branch ; git push origin $tag" -ForegroundColor DarkGray
        Write-Host "    6. gh release create $tag con 4 assets:" -ForegroundColor DarkGray
        Write-Host "         ProcessDevKill_${Version}_x64-setup.exe (+ .sha256)" -ForegroundColor DarkGray
        Write-Host "         ProcessDevKill_${Version}_x64_en-US.msi (+ .sha256)" -ForegroundColor DarkGray
        Write-Host "    7. Comprobar lo publicado: los 4 assets, la versión de la API y el hash" -ForegroundColor DarkGray
        Write-Host "       del instalador descargado" -ForegroundColor DarkGray
        if (-not $SkipTests) { Write-Host "    Ya ejecutado en este dry run: cargo test + clippy + cargo audit + npm audit + eslint + avisos de terceros + npm test + npm run build + la app en marcha" -ForegroundColor DarkGray }

        # Las notas son lo único del plan que se puede leer antes de publicarlo, y lo que no se
        # puede corregir después sin editar el release a mano.
        Write-Host ""
        Warn "Notas que se publicarían ($notesPath):"
        (Read-Texto $notesPath) -split "`r?`n" | ForEach-Object { Write-Host "    | $_" -ForegroundColor DarkGray }
        Write-Host ""
        if ($tempNotes) { Remove-Item $tempNotes -Force -ErrorAction SilentlyContinue }

        # Constancia de sobre qué código se pasaron las comprobaciones —el HEAD y lo modificado
        # encima—, para que un `-SkipTests` posterior pueda comprobar que sigue siendo el mismo.
        # Solo si se ejecutaron.
        if (-not $SkipTests) {
            $head = (& git rev-parse HEAD).Trim()
            Set-Content -Path (Get-DryRunMarkerPath) -Value @($head, (Get-DiffHuella)) -Encoding utf8
            Write-Host "    Comprobaciones anotadas para -SkipTests sobre $($head.Substring(0,7))" -ForegroundColor DarkGray
        }

        Ok "Dry run completado."
        return
    }

    # ── 1. Bump de versión en los tres sitios ────────────────────────────────
    if ($currentVersion -ne $Version) {
        Info "Actualizando la versión en tauri.conf.json, package.json y Cargo.toml..."

        # Solo la primera aparición de "version" en cada archivo: es la del propio paquete. En
        # package.json, un reemplazo global tocaría también las de las dependencias.
        $rx = [System.Text.RegularExpressions.Regex]

        $conf = Read-Texto $tauriConf
        Write-Texto $tauriConf ($rx::Replace($conf, '"version"\s*:\s*"[^"]+"', """version"": ""$Version""", 1))

        $pkg = Read-Texto $packageJson
        Write-Texto $packageJson ($rx::Replace($pkg, '"version"\s*:\s*"[^"]+"', """version"": ""$Version""", 1))

        # package-lock.json repite la versión del paquete dos veces: arriba del todo y en la
        # entrada `""` de `packages`. Las dos van antes de la primera dependencia, así que se
        # cambia solo ese tramo; lo de después son las versiones de los demás paquetes. Si el
        # tramo no tiene exactamente dos, el archivo no es como se esperaba: se avisa y no se
        # toca, que un lockfile mal escrito rompe `npm ci`.
        if (Test-Path $packageLock) {
            $lock = Read-Texto $packageLock
            $corte = $lock.IndexOf('"node_modules/')
            $cabeza = if ($corte -gt 0) { $lock.Substring(0, $corte) } else { "" }
            if ($rx::Matches($cabeza, '"version"\s*:\s*"[^"]+"').Count -eq 2) {
                $cabeza = $rx::Replace($cabeza, '"version"\s*:\s*"[^"]+"', """version"": ""$Version""")
                Write-Texto $packageLock ($cabeza + $lock.Substring($corte))
            } else {
                Warn "package-lock.json no tiene la versión del paquete donde se esperaba: no se ha tocado."
            }
        }

        $cargo = Read-Texto $cargoToml
        Write-Texto $cargoToml ($rx::Replace($cargo, '(?m)^version\s*=\s*"[^"]+"', "version = ""$Version""", 1))

        # Cargo.lock guarda la versión del propio crate: sin esto queda desactualizado y el árbol
        # aparece sucio justo después del commit del release.
        Info "Actualizando Cargo.lock..."
        Push-Location (Join-Path $root "src-tauri")
        try {
            if ((Invoke-Nativo cargo @('check','--quiet')) -ne 0) { Die "'cargo check' falló tras el bump de versión." }
        } finally { Pop-Location }
        Ok "Versión $Version puesta en los tres archivos."
    }

    # ── 2. Compilar los instaladores ─────────────────────────────────────────
    Info "Compilando los instaladores (esto tarda varios minutos)..."
    if ((Invoke-Nativo npm @('run','tauri','build')) -ne 0) { Die "La compilación de los instaladores falló." }

    if (-not (Test-Path $setup)) { Die "No se encontró el instalador NSIS esperado: $setup" }
    if (-not (Test-Path $msi))   { Die "No se encontró el MSI esperado: $msi" }
    Ok ("NSIS: {0} ({1} MB)" -f (Split-Path $setup -Leaf), [math]::Round((Get-Item $setup).Length / 1MB, 2))
    Ok ("MSI:  {0} ({1} MB)" -f (Split-Path $msi -Leaf),   [math]::Round((Get-Item $msi).Length / 1MB, 2))

    # ── 3. Checksums ─────────────────────────────────────────────────────────
    # Los genera este script: en Tauri no hay un paso de build que los produzca.
    #
    # NO SON DECORATIVOS. El `.sha256` del instalador NSIS es lo que la app descarga y
    # compara antes de ejecutar una actualización (src-tauri/src/update.rs). Si este paso
    # no publicara el hash, la app se negaría —correctamente— a actualizarse a esta versión.
    $hashes = @()
    foreach ($archivo in @($setup, $msi)) {
        $destino = "$archivo.sha256"
        $h = (Get-FileHash $archivo -Algorithm SHA256).Hash.ToLower()
        # Formato de `sha256sum`, para que valga con las herramientas de siempre.
        Write-Texto $destino "$h  $(Split-Path $archivo -Leaf)`n"
        $hashes += $destino
        Ok "SHA-256 de $(Split-Path $archivo -Leaf): $h"
    }


    # ── 4. Commit + tag ──────────────────────────────────────────────────────
    Info "Preparando commit de release..."
    if ((Invoke-Git add -u) -ne 0) { Die "git add -u falló." }
    $staged = (& git diff --cached --name-only)
    if ($staged) {
        Info "Archivos incluidos en el commit:"
        $staged | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        if ((Invoke-Git commit -m "release: v$Version") -ne 0) { Die "git commit falló." }
        Ok "Commit de release creado."
    } else {
        Info "Sin cambios que commitear; se etiqueta el HEAD actual."
    }
    Info "Creando tag $tag..."
    if ((Invoke-Git tag -a $tag -m "ProcessDevKill $tag") -ne 0) { Die "git tag falló." }

    # ── 5. Push ──────────────────────────────────────────────────────────────
    Info "Push de la rama y el tag a origin..."
    if ((Invoke-Git push origin $branch) -ne 0) { Die "git push de la rama falló." }
    if ((Invoke-Git push origin $tag) -ne 0) { Die "git push del tag falló. La rama YA está subida; reintenta." }
    Ok "Rama y tag publicados."

    # ── 6. GitHub Release ────────────────────────────────────────────────────
    $gh = Get-GhAutenticado
    if (-not $gh) { Die "gh (GitHub CLI) no está instalado o no tiene sesión. Instálalo con 'winget install GitHub.cli' y ejecuta 'gh auth login' — el tag YA está publicado; crea el release manualmente o reintenta." }

    Info "Creando el GitHub Release..."
    & $gh release create $tag --title "ProcessDevKill $tag" --notes-file $notesPath $setup $msi @hashes
    if ($LASTEXITCODE -ne 0) { Die "gh release create falló (el tag ya está publicado; puedes reintentar el release)." }

    if ($tempNotes) { Remove-Item $tempNotes -Force -ErrorAction SilentlyContinue }
    $repo = (& git remote get-url origin) -replace '\.git$', ''
    Write-Host ""
    Ok "Release $tag publicado: $repo/releases/tag/$tag"

    # ── 7. Comprobar lo publicado ────────────────────────────────────────────
    # A partir de aquí el release ESTÁ FUERA. Si esto falla no hay nada que deshacer desde el
    # script: lo que toca es decidir, y por eso el mensaje dice qué mirar.
    Info "Comprobando lo publicado..."
    $repoNombre = Get-RepoDeOrigin
    $hashSetup = (Get-FileHash $setup -Algorithm SHA256).Hash
    $problemas = Test-ReleasePublicado -gh $gh -repo $repoNombre -tag $tag -version $Version -HashLocal $hashSetup
    if ($problemas.Count -gt 0) {
        $problemas | ForEach-Object { Warn $_ }
        Die "El release $tag ESTÁ PUBLICADO pero no cuadra. Las apps instaladas pueden estar viéndolo ya: corrígelo en GitHub o despublícalo ('gh release delete $tag --yes'; ver «SI HAY QUE REVERTIR» en la cabecera). Para repetir solo esta comprobación: .\release.ps1 -Version $Version -VerifyOnly"
    }
    Ok "Comprobado: los 4 assets, la API devuelve $tag y el instalador descargado coincide con su .sha256 y con el compilado."
}
finally {
    Pop-Location

    # Devolver GH_TOKEN a como estaba. Si no existia se elimina, y no basta con asignarle "": en
    # PowerShell eso ya la borra, pero dejarlo escrito asi confunde a quien lo lea despues.
    if ($ghTokenExistia) {
        $env:GH_TOKEN = $ghTokenPrevio
    } elseif (Test-Path Env:\GH_TOKEN) {
        Remove-Item Env:\GH_TOKEN
    }
}
