<#
.SYNOPSIS
    Corta una versión de FormatDiskPro de principio a fin.

.DESCRIPTION
    Flujo completo en un paso:
      1. Valida la versión y el árbol de trabajo.
      2. Ejecuta las pruebas (salvo -SkipTests).
      3. Actualiza <Version> en el .csproj si cambió.
      4. Compila el instalador (publish self-contained + Inno Setup).
      5. Commit del bump de versión + tag anotado vX.Y.Z.
      6. Push de la rama y el tag a origin.
      7. Crea el GitHub Release adjuntando el instalador Y su .sha256.

    Para 'gh' reutiliza la credencial de GitHub ya cacheada (la del push) si no
    estuviera autenticado; nunca se imprime el token.

    IMPORTANTE: el asset .sha256 es OBLIGATORIO mientras se publique sin firmar. Desde la v1.15.0 la app
    verifica el instalador descargado antes de ejecutarlo como administrador
    (Services/UpdateService.VerifyInstallerAsync): firma Authenticode válida si la hay; si no, el hash
    SHA-256 publicado como asset. Sin ninguna de las dos, la app borra el instalador y la
    auto-actualización falla.

    Firmar (-CertThumbprint/-CertFile) sigue siendo lo deseable: evita el aviso de SmartScreen
    ("editor desconocido") y es una garantía más fuerte que el hash.

.PARAMETER Version
    Versión a publicar (X.Y.Z). Si se omite, usa la del .csproj.

.PARAMETER NotesFile
    Ruta a un archivo Markdown con las notas del release. Si se omite, se genera una plantilla.

.PARAMETER SkipTests
    Omite la ejecución de pruebas (unitarias y de UI).

.PARAMETER UiTests
    Ejecuta también los UI tests (FlaUI/UIA3), que conducen la app REAL. No van en la solución, así que
    `dotnet test` no los toca: hay que pedirlos. Requieren TERMINAL ELEVADA (la app es
    requireAdministrator y un proceso no elevado no puede automatizar su ventana), y el script lo valida
    antes de correr nada. Los 6 tests que necesitan la USB física de pruebas se OMITEN solos si no está
    conectada (no fallan), y el que borra datos de verdad se omite salvo FORMATDISKPRO_ALLOW_DESTRUCTIVE=1
    — que este script RECHAZA: un corte de release nunca debe formatear una unidad.

    Sin este flag, el script avisa de que el release sale sin haber ejercido la app real.

.PARAMETER AllowDirty
    Permite continuar con cambios sin commitear en el árbol de trabajo.

.PARAMETER DryRun
    Valida y muestra el plan, pero no modifica nada (ni build, ni git, ni GitHub).

.EXAMPLE
    .\release.ps1 -Version 1.2.0
    .\release.ps1 -Version 1.2.0 -UiTests   # recomendado: ejerce también la app real
    .\release.ps1 -Version 1.2.0 -DryRun
    .\release.ps1 -Version 1.2.0 -NotesFile notas.md
#>
[CmdletBinding()]
param(
    [string]$Version,
    [string]$NotesFile,
    [switch]$SkipTests,
    [switch]$UiTests,
    [switch]$AllowDirty,
    [switch]$DryRun,
    # Firma de código (opcional): se reenvían a build-installer.ps1.
    [string]$CertThumbprint,
    [string]$CertFile,
    [string]$CertPassword,
    [string]$TimestampUrl
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
    el release a medias (rama subida, sin tag ni GitHub Release). Ocurrió al cortar la v1.15.0 (2026-07-12),
    precisamente por lanzarlo con la salida filtrada.

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

# ── Rutas ──────────────────────────────────────────────────────────────────
$root          = $PSScriptRoot
$csproj        = Join-Path $root "src\FormatDiskPro\FormatDiskPro.csproj"
$solution      = Join-Path $root "FormatDiskPro.slnx"
$buildScript   = Join-Path $root "src\FormatDiskPro\installer\build-installer.ps1"
$outputDir     = Join-Path $root "src\FormatDiskPro\installer\Output"
# Fuera de la solución a propósito (ver -UiTests): se lanza por ruta, solo si se pide.
$uiTestProject = Join-Path $root "tests\FormatDiskPro.UiTests\FormatDiskPro.UiTests.csproj"

if (-not (Test-Path $csproj))      { Die "No se encontró el proyecto: $csproj" }
if (-not (Test-Path $buildScript)) { Die "No se encontró el script de instalador: $buildScript" }
if ($UiTests -and -not (Test-Path $uiTestProject)) { Die "No se encontró el proyecto de UI tests: $uiTestProject" }

# Se rechaza en vez de ignorarse en silencio: quien pasa las dos cosas cree que su corte lleva la app real
# probada, y saldría sin ninguna prueba en absoluto.
if ($UiTests -and $SkipTests) { Die "-UiTests y -SkipTests se contradicen: -SkipTests omite TODAS las pruebas. Elige una." }

# ── Versión ────────────────────────────────────────────────────────────────
# OJO con la codificación: NO usar `Get-Content -Raw`. En PS 5.1 lee con la página de códigos ANSI del
# sistema, así que los bytes UTF-8 de un acento (é = C3 A9) se convierten en dos caracteres (Ã©) y, al
# reescribir el archivo como UTF-8 más abajo, la corrupción queda GRABADA. Como el bump de versión ocurre
# en CADA release, el daño se acumulaba capa sobre capa: <Authors>/<Copyright> del .csproj llevaban el
# nombre del autor destrozado tras 14 versiones, y esa basura acababa en las propiedades del .exe
# publicado. ReadAllText detecta el BOM y asume UTF-8 si no lo hay; se reescribe CONSERVANDO el BOM.
$csprojRaw = [System.IO.File]::ReadAllText($csproj)
$currentVersion = $null
if ($csprojRaw -match '<Version>(.*?)</Version>') { $currentVersion = $Matches[1] }

if (-not $Version) {
    if (-not $currentVersion) { Die "No hay <Version> en el .csproj y no se pasó -Version." }
    $Version = $currentVersion
}
if ($Version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') {
    Die "Versión inválida '$Version'. Usa el formato X.Y.Z (p. ej. 1.2.0)."
}
$tag = "v$Version"
Info "Versión a publicar: $Version  (tag $tag)"
if ($currentVersion -and $currentVersion -ne $Version) {
    Info "Bump de versión: $currentVersion -> $Version"
}

# ── Validaciones de git ──────────────────────────────────────────────────────
Push-Location $root
try {
    & git rev-parse --is-inside-work-tree *> $null
    if ($LASTEXITCODE -ne 0) { Die "Este directorio no es un repositorio git." }

    $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    Info "Rama: $branch"

    # ¿Tag ya existe? (local o remoto)
    $localTag  = (& git tag --list $tag)
    if ($localTag) { Die "El tag $tag ya existe localmente. Usa otra versión o bórralo antes." }
    $remoteTag = (& git ls-remote --tags origin $tag 2>$null)
    if ($remoteTag) { Die "El tag $tag ya existe en origin. Usa otra versión." }

    # ¿Hay archivos sin rastrear? (nuevos, no añadidos con git add)
    # Estos NO se incluirán en el commit del release — el usuario debe añadirlos explícitamente.
    $untracked = (& git status --porcelain) | Where-Object { $_ -match '^\?\?' }
    if ($untracked -and -not $AllowDirty) {
        Warn "Hay archivos nuevos sin rastrear (no se incluirán en el release):"
        $untracked | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Die "Añade los archivos que necesites con 'git add <archivo>' y reintenta, o usa -AllowDirty para ignorarlos."
    } elseif ($untracked) {
        Warn "Archivos sin rastrear ignorados (-AllowDirty):"
        $untracked | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }

    # ── Pruebas ──────────────────────────────────────────────────────────────
    if ($SkipTests) {
        Warn "Pruebas omitidas (-SkipTests)."
    } else {
        Info "Ejecutando pruebas unitarias..."
        & dotnet test $solution --nologo
        if ($LASTEXITCODE -ne 0) { Die "Las pruebas unitarias fallaron. Release abortado." }
        Ok "Pruebas unitarias correctas."

        # ── UI tests (opcionales): los únicos que ejercen la app REAL ────────
        # No están en la solución a propósito: si lo estuvieran, el `dotnet test` de arriba los
        # arrastraría siempre, y necesitan condiciones que no toda máquina tiene (elevación, y la USB
        # de pruebas para 6 de ellos). Por eso se piden con -UiTests y se lanzan por ruta.
        if ($UiTests) {
            # 1. Elevación. La app es requireAdministrator: un proceso de pruebas NO elevado no puede
            #    automatizar su ventana por UI Automation. Sin esto, los 17 tests que sí corren fallarían
            #    todos a la vez con un error que no tiene nada que ver con el código.
            $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
            $isAdmin = (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole(
                [Security.Principal.WindowsBuiltInRole]::Administrator)
            if (-not $isAdmin) {
                Die "-UiTests requiere una terminal ELEVADA: FormatDiskPro.exe exige administrador y un proceso no elevado no puede automatizar su ventana. Reabre PowerShell como administrador y reintenta."
            }

            # 2. Opt-in destructivo. Con la variable a 1, la suite FORMATEA de verdad la USB de pruebas.
            #    Un corte de release jamás debe hacer eso, ni aunque quien lo lanza la tuviera activada de
            #    una sesión anterior de depuración.
            if ($env:FORMATDISKPRO_ALLOW_DESTRUCTIVE -eq "1") {
                Die "FORMATDISKPRO_ALLOW_DESTRUCTIVE=1 está activa: la suite formatearía la USB de pruebas. Un corte de release nunca debe hacerlo. Limpia la variable (`$env:FORMATDISKPRO_ALLOW_DESTRUCTIVE = `$null) y reintenta."
            }

            # 3. La USB de pruebas es OPCIONAL: los tests que la necesitan se omiten solos si no está
            #    (ver TestDriveFactAttribute). Se avisa para que quede claro qué cobertura llevó el corte.
            $testUsb = [System.IO.DriveInfo]::GetDrives() | Where-Object {
                $_.DriveType -eq 'Removable' -and $_.IsReady -and $_.VolumeLabel -eq 'utilidades'
            } | Select-Object -First 1
            if ($testUsb) {
                Info "USB de pruebas detectada ($($testUsb.Name)): los tests de diagnóstico también correrán."
            } else {
                Warn "USB de pruebas ('utilidades') NO conectada: sus tests se OMITIRÁN (no fallarán). El resto sí ejerce la app real."
            }

            Info "Ejecutando UI tests (conducen la app real; se abrirán ventanas)..."
            & dotnet test $uiTestProject --filter "Category!=Slow" --nologo
            if ($LASTEXITCODE -ne 0) { Die "Los UI tests fallaron. Release abortado." }
            Ok "UI tests correctos."
        } else {
            Warn "UI tests NO ejecutados (sin -UiTests): este release sale sin haber ejercido la app real. Recomendado: .\release.ps1 -Version $Version -UiTests (desde una terminal elevada)."
        }
    }

    # ── Notas del release ──────────────────────────────────────────────────────
    $notesPath = $NotesFile
    $tempNotes = $null
    if (-not $notesPath) {
        $tempNotes = Join-Path $env:TEMP "fdp_release_$Version.md"
        @(
            "## FormatDiskPro v$Version",
            "",
            "Instalador self-contained para Windows x64 (no requiere instalar .NET).",
            "",
            "Descarga ``FormatDiskPro-$Version-setup.exe`` y ejecútalo (requiere privilegios de administrador).",
            "",
            "La app comprueba actualizaciones automáticamente desde *Ayuda → Buscar actualizaciones…*.",
            "",
            "El asset ``FormatDiskPro-$Version-setup.exe.sha256`` es el hash con el que la app verifica la descarga antes de ejecutarla."
        ) | Out-File -FilePath $tempNotes -Encoding utf8
        $notesPath = $tempNotes
    }
    if (-not (Test-Path $notesPath)) { Die "No se encontró el archivo de notas: $notesPath" }

    # ── DRY RUN: mostrar plan y salir ────────────────────────────────────────
    if ($DryRun) {
        Write-Host ""
        Warn "DRY RUN — no se modificará nada. Plan:"
        $signNote = if ($CertThumbprint -or $CertFile) { " (firmando con Authenticode)" } else { " (SIN firmar — la app verificará por el .sha256)" }
        Write-Host "    1. Actualizar <Version> a $Version en el .csproj" -ForegroundColor DarkGray
        Write-Host "    2. build-installer.ps1 -Version $Version$signNote" -ForegroundColor DarkGray
        Write-Host "    3. git add -u  (todos los archivos rastreados modificados)" -ForegroundColor DarkGray
        Write-Host "       git commit -m 'release: v$Version'" -ForegroundColor DarkGray
        Write-Host "       git tag -a $tag" -ForegroundColor DarkGray
        Write-Host "    4. git push origin $branch" -ForegroundColor DarkGray
        Write-Host "       git push origin $tag" -ForegroundColor DarkGray
        Write-Host "    5. gh release create $tag (assets: FormatDiskPro-$Version-setup.exe + .sha256)" -ForegroundColor DarkGray
        if (-not $SkipTests) {
            $uiNote = if ($UiTests) { "unitarias + UI tests (app real)" } else { "solo unitarias (sin -UiTests)" }
            Write-Host "    Pruebas ya ejecutadas en este dry run: $uiNote" -ForegroundColor DarkGray
        }
        if ($tempNotes) { Remove-Item $tempNotes -Force -ErrorAction SilentlyContinue }
        Ok "Dry run completado."
        return
    }

    # ── 1. Bump de versión ───────────────────────────────────────────────────
    if ($currentVersion -ne $Version) {
        Info "Actualizando <Version> en el .csproj..."
        $newRaw = $csprojRaw -replace '<Version>.*?</Version>', "<Version>$Version</Version>"
        # CON BOM ($true), no sin él: es lo que hace que la próxima lectura —la del siguiente release, o la
        # de MSBuild— sepa con certeza que el archivo es UTF-8. Sin BOM, PS 5.1 y MSBuild caen en la página
        # de códigos ANSI y vuelven a romper los acentos de <Authors>/<Copyright>. Ver la nota de arriba.
        [System.IO.File]::WriteAllText($csproj, $newRaw, (New-Object System.Text.UTF8Encoding($true)))
    }

    # ── 2. Compilar instalador ─────────────────────────────────────────────────
    Info "Compilando el instalador..."
    $buildArgs = @{ Version = $Version }
    if ($CertThumbprint) { $buildArgs.CertThumbprint = $CertThumbprint }
    if ($CertFile)       { $buildArgs.CertFile       = $CertFile }
    if ($CertPassword)   { $buildArgs.CertPassword   = $CertPassword }
    if ($TimestampUrl)   { $buildArgs.TimestampUrl   = $TimestampUrl }
    & $buildScript @buildArgs
    if ($LASTEXITCODE -ne 0) { Die "La compilación del instalador falló." }
    $setup = Join-Path $outputDir "FormatDiskPro-$Version-setup.exe"
    if (-not (Test-Path $setup)) { Die "No se encontró el instalador esperado: $setup" }
    $sizeMB = [math]::Round((Get-Item $setup).Length / 1MB, 1)
    Ok "Instalador: $setup ($sizeMB MB)"

    # Lo genera build-installer.ps1. Es con lo que la app verifica la descarga mientras los instaladores
    # se publiquen sin firmar (UpdateService.VerifyInstallerAsync): si no se sube como asset, la
    # auto-actualización no puede verificar nada, borra el instalador y falla.
    $setupHash = "$setup.sha256"
    if (-not (Test-Path $setupHash)) { Die "No se encontró el checksum esperado: $setupHash" }
    Ok "Checksum: $setupHash"

    # ── 3. Commit + tag ──────────────────────────────────────────────────────
    # Añade todos los archivos rastreados modificados/eliminados (tracked changes).
    # Los archivos nuevos sin rastrear requieren 'git add' manual previo.
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
    if ((Invoke-Git tag -a $tag -m "FormatDiskPro $tag") -ne 0) { Die "git tag falló." }

    # ── 4. Push ──────────────────────────────────────────────────────────────
    # Vía Invoke-Git a propósito: git escribe el resumen del push por stderr y, con
    # $ErrorActionPreference = "Stop", eso abortaría el script DESPUÉS de haber empujado la rama,
    # dejando el release a medias (sin tag ni GitHub Release). Ver la nota de Invoke-Git.
    Info "Push de la rama y el tag a origin..."
    if ((Invoke-Git push origin $branch) -ne 0) { Die "git push de la rama falló." }
    if ((Invoke-Git push origin $tag) -ne 0) { Die "git push del tag falló. La rama YA está subida; reintenta." }
    Ok "Rama y tag publicados."

    # ── 5. GitHub Release ────────────────────────────────────────────────────
    $gh = @(
        "C:\Program Files\GitHub CLI\gh.exe",
        "C:\Program Files (x86)\GitHub CLI\gh.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $gh) {
        $cmd = Get-Command gh -ErrorAction SilentlyContinue
        if ($cmd) { $gh = $cmd.Source }
    }
    if (-not $gh) { Die "gh (GitHub CLI) no está instalado. Instálalo: winget install GitHub.cli  — el tag YA está publicado; crea el release manualmente o reintenta." }

    # Asegurar autenticación: si gh no está logueado, reutilizar la credencial cacheada de git.
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
    & $gh release create $tag --title "FormatDiskPro $tag" --notes-file $notesPath $setup $setupHash
    if ($LASTEXITCODE -ne 0) { Die "gh release create falló (el tag ya está publicado; puedes reintentar el release)." }

    if ($tempNotes) { Remove-Item $tempNotes -Force -ErrorAction SilentlyContinue }
    Write-Host ""
    Ok "Release $tag publicado: https://github.com/xfiberex/FormatDiskPro/releases/tag/$tag"
}
finally {
    Pop-Location
}
