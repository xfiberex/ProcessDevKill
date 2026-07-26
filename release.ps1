<#
.SYNOPSIS
    Corta una versión de ProcessDevKill de principio a fin.

.DESCRIPTION
    Flujo completo en un paso:
      1. Valida la versión y el árbol de trabajo.
      2. Ejecuta las pruebas (salvo -SkipTests): `cargo test`, `npm test` y `npm run build`.
      3. Actualiza la versión en los TRES sitios donde vive.
      4. Compila los instaladores con `npm run tauri build` (NSIS + MSI).
      5. Genera el .sha256 de cada instalador — con el que la app verifica la actualización.
      6. Commit del bump de versión + tag anotado vX.Y.Z.
      7. Push de la rama y el tag a origin.
      8. Crea el GitHub Release adjuntando los instaladores y sus .sha256.

    Para 'gh' reutiliza la credencial de GitHub ya cacheada (la del push) si no
    estuviera autenticado; nunca se imprime el token.

    LA VERSIÓN VIVE EN TRES SITIOS y tienen que ir a la vez:
      - src-tauri/tauri.conf.json  → es la que MANDA (la que acaba en el instalador y el .exe)
      - package.json               → la del paquete npm
      - src-tauri/Cargo.toml       → la del crate, y arrastra a Cargo.lock
    Si se tocara solo una, el instalador y el binario saldrían con versiones distintas. Tras
    cambiar Cargo.toml se corre `cargo check` para que Cargo.lock quede al día; si no, el
    commit del release deja el árbol sucio justo después de haberlo commiteado.

    EL .sha256 NO ES CORTESÍA: ES LO QUE VERIFICA LA AUTO-ACTUALIZACIÓN.

    La app descarga el instalador del último release y lo compara con el `.sha256` que este
    script publica junto a él ANTES de ejecutarlo; si no coincide, lo borra y no instala
    nada (ver src-tauri/src/update.rs). Si un release saliera sin su `.sha256`, la app se
    negaría a actualizarse a él — que es el comportamiento correcto, pero conviene saberlo.

    Alcance honesto: el instalador y su hash salen del MISMO release, así que esto detecta
    una descarga corrupta o manipulada EN TRÁNSITO, pero no protege frente a un compromiso
    de la cuenta de GitHub, porque quien pudiera sustituir el .exe podría sustituir también
    el hash. Es el compromiso habitual de un proyecto sin certificado de firma de código.

    FIRMA DE CÓDIGO AUTHENTICODE: no la hay. Es la que quitaría el aviso de SmartScreen
    ("editor desconocido") y la que permitiría una verificación fuerte de origen. Requiere
    un certificado de pago; en Tauri se configuraría con `bundle.windows.certificateThumbprint`,
    no llamando a signtool a mano.

    Las pruebas de Rust son seguras para un corte de release: leen los procesos del sistema y
    solo matan procesos que ellas mismas lanzan. Ninguna toca los del usuario.

.PARAMETER Version
    Versión a publicar (X.Y.Z). Si se omite, usa la de tauri.conf.json.

.PARAMETER NotesFile
    Ruta a un archivo Markdown con las notas del release. Si se omite, se genera una plantilla.

.PARAMETER SkipTests
    Omite `cargo test`, `npm test` y `npm run build`.

.PARAMETER AllowDirty
    Permite continuar con archivos sin rastrear en el árbol de trabajo.

.PARAMETER DryRun
    Valida y muestra el plan, pero no modifica nada (ni build, ni git, ni GitHub).

.EXAMPLE
    .\release.ps1 -Version 1.0.0 -DryRun
    .\release.ps1 -Version 1.0.0
#>
[CmdletBinding()]
param(
    [string]$Version,
    [string]$NotesFile,
    [switch]$SkipTests,
    [switch]$AllowDirty,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Info($m)  { Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)    { Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m)  { Write-Host "[!] $m" -ForegroundColor Yellow }
function Die($m)   { Write-Host "[X] $m" -ForegroundColor Red; exit 1 }

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

# ── Rutas ──────────────────────────────────────────────────────────────────
$root       = $PSScriptRoot
$tauriConf  = Join-Path $root "src-tauri\tauri.conf.json"
$packageJson= Join-Path $root "package.json"
$cargoToml  = Join-Path $root "src-tauri\Cargo.toml"
$bundleDir  = Join-Path $root "src-tauri\target\release\bundle"

foreach ($f in @($tauriConf, $packageJson, $cargoToml)) {
    if (-not (Test-Path $f)) { Die "No se encontró $f" }
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
Info "Versión a publicar: $Version  (tag $tag)"
if ($currentVersion -and $currentVersion -ne $Version) {
    Info "Bump de versión: $currentVersion -> $Version"
}

$setup = Join-Path $bundleDir "nsis\ProcessDevKill_${Version}_x64-setup.exe"
$msi   = Join-Path $bundleDir "msi\ProcessDevKill_${Version}_x64_en-US.msi"

# ── Validaciones de git ──────────────────────────────────────────────────────
Push-Location $root
try {
    & git rev-parse --is-inside-work-tree *> $null
    if ($LASTEXITCODE -ne 0) { Die "Este directorio no es un repositorio git." }

    $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    Info "Rama: $branch"

    $localTag = (& git tag --list $tag)
    if ($localTag) { Die "El tag $tag ya existe localmente. Usa otra versión o bórralo antes." }
    $remoteTag = (& git ls-remote --tags origin $tag 2>$null)
    if ($remoteTag) { Die "El tag $tag ya existe en origin. Usa otra versión." }

    # Archivos nuevos sin rastrear: NO entran en el commit del release. Se avisa y se para, porque
    # olvidarse de un `git add` aquí publica una versión a la que le falta código.
    $untracked = (& git status --porcelain) | Where-Object { $_ -match '^\?\?' }
    if ($untracked -and -not $AllowDirty) {
        Warn "Hay archivos nuevos sin rastrear (no se incluirán en el release):"
        $untracked | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Die "Añade los que necesites con 'git add <archivo>' y reintenta, o usa -AllowDirty para ignorarlos."
    } elseif ($untracked) {
        Warn "Archivos sin rastrear ignorados (-AllowDirty):"
        $untracked | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }


    # ── Pruebas ──────────────────────────────────────────────────────────────
    if ($SkipTests) {
        Warn "Pruebas omitidas (-SkipTests)."
    } else {
        Info "Ejecutando los tests de Rust..."
        Push-Location (Join-Path $root "src-tauri")
        try {
            if ((Invoke-Nativo cargo @('test','--quiet')) -ne 0) { Die "Los tests de Rust fallaron. Release abortado." }
        } finally { Pop-Location }
        Ok "Tests de Rust correctos."

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
    }

    # ── Notas del release ──────────────────────────────────────────────────────
    $notesPath = $NotesFile
    $tempNotes = $null
    if (-not $notesPath) {
        $tempNotes = Join-Path $env:TEMP "pdk_release_$Version.md"
        @(
            "## ProcessDevKill v$Version",
            "",
            "Gestor de procesos de desarrollo para Windows: lista los `node`, `python` y `dotnet` activos con su CPU, su RAM y **el puerto local que ocupa cada uno**, y permite cerrarlos de uno en uno o en lote.",
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
            "Los instaladores no están firmados, así que la primera vez Windows mostrará el aviso de SmartScreen (*Windows protegió su PC*): Más información → Ejecutar de todas formas.",
            "",
            "Requiere Windows 10/11 con WebView2 (incluido de serie en Windows 11)."
        ) | Out-File -FilePath $tempNotes -Encoding utf8
        $notesPath = $tempNotes
    }
    if (-not (Test-Path $notesPath)) { Die "No se encontró el archivo de notas: $notesPath" }

    # ── DRY RUN: mostrar plan y salir ────────────────────────────────────────
    if ($DryRun) {
        Write-Host ""
        Warn "DRY RUN — no se modificará nada. Plan:"
        Write-Host "    1. Poner la versión $Version en tauri.conf.json, package.json y Cargo.toml" -ForegroundColor DarkGray
        Write-Host "       + 'cargo check' para actualizar Cargo.lock" -ForegroundColor DarkGray
        Write-Host "    2. npm run tauri build  (NSIS + MSI, SIN firma de código:" -ForegroundColor DarkGray
        Write-Host "       SmartScreen seguirá avisando)" -ForegroundColor DarkGray
        Write-Host "    3. Generar los .sha256 — con el que la app verifica la actualización" -ForegroundColor DarkGray
        Write-Host "    4. git add -u ; git commit -m 'release: v$Version' ; git tag -a $tag" -ForegroundColor DarkGray
        Write-Host "    5. git push origin $branch ; git push origin $tag" -ForegroundColor DarkGray
        Write-Host "    6. gh release create $tag con 4 assets:" -ForegroundColor DarkGray
        Write-Host "         ProcessDevKill_${Version}_x64-setup.exe (+ .sha256)" -ForegroundColor DarkGray
        Write-Host "         ProcessDevKill_${Version}_x64_en-US.msi (+ .sha256)" -ForegroundColor DarkGray
        if (-not $SkipTests) { Write-Host "    Pruebas ya ejecutadas en este dry run: cargo test + npm test + npm run build" -ForegroundColor DarkGray }
        if ($tempNotes) { Remove-Item $tempNotes -Force -ErrorAction SilentlyContinue }
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
    $gh = @(
        "C:\Program Files\GitHub CLI\gh.exe",
        "C:\Program Files (x86)\GitHub CLI\gh.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $gh) {
        $cmd = Get-Command gh -ErrorAction SilentlyContinue
        if ($cmd) { $gh = $cmd.Source }
    }
    if (-not $gh) { Die "gh (GitHub CLI) no está instalado. Instálalo: winget install GitHub.cli  — el tag YA está publicado; crea el release manualmente o reintenta." }

    # Si gh no está logueado, reutilizar la credencial cacheada de git (la misma del push).
    # PS 5.1: 2>$null en exes nativos con ErrorActionPreference=Stop genera NativeCommandError;
    # se baja a SilentlyContinue solo durante las llamadas que necesitan suprimir stderr.
    $eap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    & $gh auth status 2>$null
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
        if (-not $env:GH_TOKEN) { Die "No se pudo obtener credencial para gh. Ejecuta 'gh auth login' y reintenta (el tag ya está publicado)." }
    }

    Info "Creando el GitHub Release..."
    & $gh release create $tag --title "ProcessDevKill $tag" --notes-file $notesPath $setup $msi @hashes
    if ($LASTEXITCODE -ne 0) { Die "gh release create falló (el tag ya está publicado; puedes reintentar el release)." }

    if ($tempNotes) { Remove-Item $tempNotes -Force -ErrorAction SilentlyContinue }
    $repo = (& git remote get-url origin) -replace '\.git$', ''
    Write-Host ""
    Ok "Release $tag publicado: $repo/releases/tag/$tag"
}
finally {
    Pop-Location
}
