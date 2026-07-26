<#
.SYNOPSIS
    Corta una versión de ProcessDevKill de principio a fin.

.DESCRIPTION
    Flujo completo en un paso:
      1. Valida la versión y el árbol de trabajo.
      2. Ejecuta las pruebas (salvo -SkipTests): `cargo test`, `npm test` y `npm run build`.
      3. Actualiza la versión en los TRES sitios donde vive.
      4. Compila los instaladores con `npm run tauri build` (NSIS + MSI), firmados.
      5. Genera el .sha256 de cada instalador y el latest.json del actualizador.
      6. Commit del bump de versión + tag anotado vX.Y.Z.
      7. Push de la rama y el tag a origin.
      8. Crea el GitHub Release adjuntando instaladores, .sha256, .sig y latest.json.

    Para 'gh' reutiliza la credencial de GitHub ya cacheada (la del push) si no
    estuviera autenticado; nunca se imprime el token.

    LA VERSIÓN VIVE EN TRES SITIOS y tienen que ir a la vez:
      - src-tauri/tauri.conf.json  → es la que MANDA (la que acaba en el instalador y el .exe)
      - package.json               → la del paquete npm
      - src-tauri/Cargo.toml       → la del crate, y arrastra a Cargo.lock
    Si se tocara solo una, el instalador y el binario saldrían con versiones distintas. Tras
    cambiar Cargo.toml se corre `cargo check` para que Cargo.lock quede al día; si no, el
    commit del release deja el árbol sucio justo después de haberlo commiteado.

    DOS FIRMAS DISTINTAS, NO CONFUNDIRLAS:

      - minisign (SÍ la hay, desde el Tier 6.5). Es lo que verifica el actualizador: la
        clave pública va compilada en el binario y la privada vive FUERA del repositorio,
        en la máquina que corta releases, PROTEGIDA CON CONTRASEÑA. Firma los bundles y
        produce los .sig. Perderla —el archivo o la contraseña— significa que los usuarios
        ya instalados no podrán volver a actualizarse nunca, porque una clave nueva no
        valida lo que firmó la vieja. Hacer copia de seguridad de las dos cosas.

      - firma de código Authenticode (NO la hay). Es la que quita el aviso de SmartScreen
        ("editor desconocido"). Requiere un certificado de pago; en Tauri se configuraría
        con `bundle.windows.certificateThumbprint`, no llamando a signtool a mano.

    Y EL .sha256 no es ninguna de las dos: es cortesía para verificar a mano una descarga
    corrupta. El actualizador NO lo mira; viaja por el mismo sitio que el instalador, así
    que no demuestra quién publicó el archivo.

    Las pruebas de Rust son seguras para un corte de release: leen los procesos del sistema y
    solo matan procesos que ellas mismas lanzan. Ninguna toca los del usuario.

.PARAMETER Version
    Versión a publicar (X.Y.Z). Si se omite, usa la de tauri.conf.json.

.PARAMETER NotesFile
    Ruta a un archivo Markdown con las notas del release. Si se omite, se genera una plantilla.

.PARAMETER SigningKey
    Ruta a la clave privada minisign que firma la actualización. Por defecto
    %USERPROFILE%\.tauri\processdevkill.key, o TAURI_SIGNING_PRIVATE_KEY_PATH si está puesta.

    La clave lleva CONTRASEÑA. El script la pide por consola, sin eco, salvo que ya venga en
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD. Se comprueba nada más empezar, firmando un archivo de
    prueba: teclearla mal aborta en el primer minuto, no después de compilar.

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
    [string]$SigningKey,
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
    Obtiene la contraseña de la clave de firma, sin dejarla escrita en ningún sitio.

.DESCRIPTION
    Dos vías, por ese orden:
      1. La variable TAURI_SIGNING_PRIVATE_KEY_PASSWORD, si ya viene puesta. Es la que se
         usaría desde un script que llame a este, o desde CI el día que lo haya.
      2. Preguntar por consola sin eco (Read-Host -AsSecureString), que es lo normal al
         cortar un release a mano.

    La SecureString hay que convertirla a texto plano porque es lo que espera Tauri en la
    variable de entorno; se libera el BSTR en el finally para no dejar la copia en memoria
    más de lo imprescindible. No es una garantía fuerte —el proceso hijo la recibe en claro
    de todos modos—, pero evita que quede en el historial de la consola.
#>
function Get-PasswordDeFirma {
    if ($env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
        Info "Contraseña de firma tomada de TAURI_SIGNING_PRIVATE_KEY_PASSWORD."
        return $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
    }

    $segura = Read-Host "Contraseña de la clave de firma" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
    try   { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

<#
.SYNOPSIS
    Ejecuta un comando con la clave de firma en el entorno del PROCESO HIJO, no en esta sesión.

.DESCRIPTION
    Dos razones para no hacer simplemente `$env:X = ...` y llamar a npm:

    1. LA CLAVE NO DEBE QUEDARSE EN LA SESIÓN de quien ejecuta el script. Aquí vive y muere
       con el proceso hijo.

    2. EN POWERSHELL, `$env:VAR = ""` BORRA LA VARIABLE. No la deja vacía: la elimina, porque
       [Environment]::SetEnvironmentVariable trata la cadena vacía igual que $null. Se
       comprueba en dos líneas:

           $env:PRUEBA = ""; Test-Path Env:\PRUEBA   # -> False

       Con una clave SIN contraseña hay que pasar un TAURI_SIGNING_PRIVATE_KEY_PASSWORD
       vacío; al desaparecer la variable, el CLI decide preguntar por consola ("Decrypting
       updater signing key, expect a prompt for password") y el build SE QUEDA COLGADO PARA
       SIEMPRE esperando una pulsación que en un script automatizado no llega. No falla: se
       queda ahí. Pasó de verdad el 2026-07-25 cortando la v1.1.0.

       Hoy la clave de este proyecto SÍ tiene contraseña, así que ese caso concreto ya no se
       da; ProcessStartInfo.Environment se mantiene porque sigue siendo lo correcto por (1)
       y porque el día que alguien vuelva a una clave sin contraseña, seguirá funcionando.

    Sin redirigir la salida, el hijo hereda la consola y el progreso se ve en vivo. Va por
    cmd.exe porque `npm` en Windows es `npm.cmd` y CreateProcess no sabe ejecutar un .cmd
    directamente con UseShellExecute a $false.

    NOTA sobre el aviso PSAvoidUsingPlainTextForPassword del analizador: $password entra como
    String a propósito y no como SecureString. Tauri lee la contraseña de una VARIABLE DE
    ENTORNO, que es texto plano por definición, así que la conversión hay que hacerla sí o sí;
    lo único que se puede elegir es dónde. Se hace lo antes posible en Get-PasswordDeFirma
    —que sí usa SecureString para leerla del teclado y libera el BSTR— y desde ahí viaja en
    claro el trecho mínimo, sin tocar la sesión del usuario ni el historial de la consola.
#>
function Invoke-ConClaveDeFirma($rutaClave, $password, $comando) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName         = "$env:ComSpec"
    $psi.Arguments        = "/c $comando"
    $psi.WorkingDirectory = $root
    $psi.UseShellExecute  = $false

    $psi.Environment["TAURI_SIGNING_PRIVATE_KEY"] = (Read-Texto $rutaClave).Trim()
    $psi.Environment["TAURI_SIGNING_PRIVATE_KEY_PASSWORD"] = $password

    $p = [System.Diagnostics.Process]::Start($psi)
    $p.WaitForExit()
    return $p.ExitCode
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

# ── Firma de actualizacion (minisign) ────────────────────────────────────────
# La clave privada NO vive en el repositorio: sin CI, vive en la maquina que corta
# releases. Si falta, se para aqui en vez de compilar sin firmar: un release sin .sig
# deja a todos los usuarios instalados sin poder actualizarse, y no se nota hasta que
# alguien lo intenta.
if (-not $SigningKey) {
    $SigningKey = if ($env:TAURI_SIGNING_PRIVATE_KEY_PATH) { $env:TAURI_SIGNING_PRIVATE_KEY_PATH }
                  else { Join-Path $env:USERPROFILE ".tauri\processdevkill.key" }
}
$sigSetup   = "$setup.sig"
$latestJson = Join-Path $bundleDir "latest.json"

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

    # Se comprueba ANTES de las pruebas y del build: descubrir que falta la clave
    # después de veinte minutos compilando es la peor forma de enterarse.
    if (-not (Test-Path $SigningKey)) {
        Die @"
No se encontró la clave de firma de actualizaciones: $SigningKey
Sin ella el instalador sale sin .sig y los usuarios ya instalados no podrían actualizarse.
Si la tienes en otro sitio, indícala con -SigningKey.

Generar un par NUEVO deja tirados a todos los usuarios ya instalados: su binario lleva
grabada la clave pública vieja y rechazará lo que firme la nueva. Hazlo solo si no existe
ninguna clave, o si la actual está comprometida:
    npm run tauri signer generate -- -w "`$env:USERPROFILE\.tauri\processdevkill.key" -f
(pedirá una contraseña; guárdala junto a la clave)
y pon la clave pública resultante en plugins.updater.pubkey de src-tauri/tauri.conf.json.
"@
    }
    Ok "Clave de firma encontrada: $SigningKey"

    # La contraseña se pide AQUÍ, no antes del build: así el fallo por teclearla mal aparece
    # en el primer minuto y no después de compilar. Se comprueba firmando un archivo de
    # prueba, que es la única forma de saber que abre la clave sin esperar al build entero.
    $firmaPassword = Get-PasswordDeFirma
    $pruebaFirma = Join-Path $env:TEMP "pdk_prueba_firma_$Version.txt"
    Write-Texto $pruebaFirma "comprobacion de la clave de firma`n"
    try {
        Info "Comprobando que la contraseña abre la clave..."
        $r = Invoke-ConClaveDeFirma $SigningKey $firmaPassword "npx tauri signer sign `"$pruebaFirma`" > nul 2>&1"
        if ($r -ne 0) {
            Die "La contraseña no abre la clave de firma (o la clave no es válida). Release abortado antes de compilar."
        }
        Ok "La contraseña abre la clave."
    }
    finally {
        Remove-Item $pruebaFirma, "$pruebaFirma.sig" -Force -ErrorAction SilentlyContinue
    }

    # ── Pruebas ──────────────────────────────────────────────────────────────
    if ($SkipTests) {
        Warn "Pruebas omitidas (-SkipTests)."
    } else {
        Info "Ejecutando los tests de Rust..."
        Push-Location (Join-Path $root "src-tauri")
        try {
            & cargo test --quiet
            if ($LASTEXITCODE -ne 0) { Die "Los tests de Rust fallaron. Release abortado." }
        } finally { Pop-Location }
        Ok "Tests de Rust correctos."

        # Pruebas del frontend (Vitest + Testing Library, Tier 6.4). Corren en jsdom con los
        # modulos de Tauri doblados, asi que no tocan procesos reales ni necesitan la ventana:
        # son seguras dentro de un corte de release, igual que las de Rust.
        Info "Ejecutando los tests del frontend..."
        & npm test
        if ($LASTEXITCODE -ne 0) { Die "Los tests del frontend fallaron. Release abortado." }
        Ok "Tests del frontend correctos."

        # `npm run build` es `tsc && vite build`: comprueba los tipos del frontend. Vale la pena
        # aparte, aunque `tauri build` lo repita, para fallar antes de empezar a compilar Rust.
        Info "Comprobando tipos y compilando el frontend..."
        & npm run build
        if ($LASTEXITCODE -ne 0) { Die "El build del frontend falló. Release abortado." }
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
        Write-Host "    2. npm run tauri build  (NSIS + MSI; firmados con minisign para el updater," -ForegroundColor DarkGray
        Write-Host "       pero SIN firma de código: SmartScreen seguirá avisando)" -ForegroundColor DarkGray
        Write-Host "    3. Generar los .sha256 y el latest.json del actualizador" -ForegroundColor DarkGray
        Write-Host "    4. git add -u ; git commit -m 'release: v$Version' ; git tag -a $tag" -ForegroundColor DarkGray
        Write-Host "    5. git push origin $branch ; git push origin $tag" -ForegroundColor DarkGray
        Write-Host "    6. gh release create $tag con 6 assets:" -ForegroundColor DarkGray
        Write-Host "         ProcessDevKill_${Version}_x64-setup.exe (+ .sha256 + .sig)" -ForegroundColor DarkGray
        Write-Host "         ProcessDevKill_${Version}_x64_en-US.msi (+ .sha256)" -ForegroundColor DarkGray
        Write-Host "         latest.json" -ForegroundColor DarkGray
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
            & cargo check --quiet 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) { Die "'cargo check' falló tras el bump de versión." }
        } finally { Pop-Location }
        Ok "Versión $Version puesta en los tres archivos."
    }

    # ── 2. Compilar los instaladores, firmados ───────────────────────────────
    # Tauri firma cada bundle y deja un .sig al lado cuando encuentra la clave en el entorno,
    # PERO solo si bundle.createUpdaterArtifacts está a true en tauri.conf.json: viene a false
    # de fábrica y sin ella compila los instaladores sin firmar y sin quejarse. De ahí la
    # comprobación del .sig unas líneas más abajo.
    Info "Compilando los instaladores, firmados (esto tarda varios minutos)..."
    # La clave y su contraseña van al proceso hijo, no a esta sesión. Ver Invoke-ConClaveDeFirma.
    if ((Invoke-ConClaveDeFirma $SigningKey $firmaPassword "npm run tauri build") -ne 0) {
        Die "La compilación de los instaladores falló."
    }

    if (-not (Test-Path $setup)) { Die "No se encontró el instalador NSIS esperado: $setup" }
    if (-not (Test-Path $msi))   { Die "No se encontró el MSI esperado: $msi" }
    if (-not (Test-Path $sigSetup)) {
        Die "No se generó la firma $sigSetup. Sin ella el latest.json no vale y nadie podría actualizarse."
    }
    Ok ("NSIS: {0} ({1} MB)" -f (Split-Path $setup -Leaf), [math]::Round((Get-Item $setup).Length / 1MB, 2))
    Ok ("MSI:  {0} ({1} MB)" -f (Split-Path $msi -Leaf),   [math]::Round((Get-Item $msi).Length / 1MB, 2))

    # ── 3. Checksums ─────────────────────────────────────────────────────────
    # Los genera este script: en Tauri no hay un paso de build que los produzca.
    $hashes = @()
    foreach ($archivo in @($setup, $msi)) {
        $destino = "$archivo.sha256"
        $h = (Get-FileHash $archivo -Algorithm SHA256).Hash.ToLower()
        # Formato de `sha256sum`, para que valga con las herramientas de siempre.
        Write-Texto $destino "$h  $(Split-Path $archivo -Leaf)`n"
        $hashes += $destino
        Ok "SHA-256 de $(Split-Path $archivo -Leaf): $h"
    }

    # ── 3b. latest.json para el actualizador ─────────────────────────────────
    # Es lo que consulta la app instalada. Va como asset del release y se descarga por
    # la URL .../releases/latest/download/latest.json, que GitHub resuelve siempre al
    # último release no-prerelease. El campo `signature` es el CONTENIDO del .sig, no
    # su ruta; el plugin lo verifica contra la clave pública compilada en el binario.
    Info "Generando latest.json..."
    $repoUrl = ((& git remote get-url origin) -replace '\.git$', '').Trim()
    $manifest = [ordered]@{
        version   = $Version
        notes     = "ProcessDevKill v$Version. Las notas completas están en $repoUrl/releases/tag/$tag"
        pub_date  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        platforms = [ordered]@{
            "windows-x86_64" = [ordered]@{
                signature = (Read-Texto $sigSetup).Trim()
                url       = "$repoUrl/releases/download/$tag/$(Split-Path $setup -Leaf)"
            }
        }
    }
    Write-Texto $latestJson ($manifest | ConvertTo-Json -Depth 5)
    Ok "latest.json generado apuntando a $(Split-Path $setup -Leaf)."

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
    & $gh release create $tag --title "ProcessDevKill $tag" --notes-file $notesPath $setup $msi $sigSetup $latestJson @hashes
    if ($LASTEXITCODE -ne 0) { Die "gh release create falló (el tag ya está publicado; puedes reintentar el release)." }

    if ($tempNotes) { Remove-Item $tempNotes -Force -ErrorAction SilentlyContinue }
    $repo = (& git remote get-url origin) -replace '\.git$', ''
    Write-Host ""
    Ok "Release $tag publicado: $repo/releases/tag/$tag"
}
finally {
    # No hay variables de entorno que limpiar: la clave y su contraseña viven solo dentro de
    # los procesos hijos que lanza Invoke-ConClaveDeFirma, y mueren con ellos.
    Pop-Location
}
