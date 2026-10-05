<#
.SYNOPSIS
    Lo que CDP no alcanza de la copia de prueba: sus ventanas de Windows y las teclas de verdad.

.DESCRIPTION
    Lo llama tools/envivo.mjs. Este archivo va SIN TILDES a proposito: PowerShell 5.1 lee un .ps1
    sin BOM como ANSI, y una tilde en UTF-8 rompe el analisis.

    -Accion ventanas  Lista las ventanas visibles de nivel superior del proceso y de sus hijos
                      (WebView2 corre en procesos hijos). El menu de clic derecho del navegador es
                      una de esas ventanas: asi se ve si ha salido (T14-02).
    -Accion teclas    Pone delante la ventana de la copia y pulsa una combinacion con keybd_event.
                      Un atajo del navegador (F5, Ctrl+R) no se dispara con un evento de CDP ni con
                      un mensaje a la ventana: hace falta entrada real.

    LAS TECLAS SOLO SALEN SI LA VENTANA DE DELANTE ES LA DE LA COPIA. Se comprueba justo antes de
    cada pulsacion; si no lo es, no se pulsa nada y se contesta ok=false. Una tecla real va a quien
    tenga el foco, y ese puede ser un programa del usuario: es la regla que no se rompe.

    Contesta siempre una linea de JSON.
#>
param(
    [Parameter(Mandatory)][int]$IdProceso,
    [Parameter(Mandatory)][ValidateSet("ventanas", "teclas")][string]$Accion,
    # Codigos de tecla virtual separados por comas, en el orden en que se pulsan: "17,82" es Ctrl+R.
    [string]$Teclas = ""
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class PdkVentana {
    delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }

    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc fn, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT r);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hwnd);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();

    public class Ventana { public long Hwnd; public string Clase; public uint Pid; public int Ancho; public int Alto; }

    public static List<Ventana> Ventanas(HashSet<uint> pids) {
        var lista = new List<Ventana>();
        EnumWindows((hwnd, l) => {
            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            if (!pids.Contains(pid) || !IsWindowVisible(hwnd)) return true;
            var clase = new StringBuilder(256);
            GetClassName(hwnd, clase, 256);
            RECT r;
            GetWindowRect(hwnd, out r);
            lista.Add(new Ventana { Hwnd = hwnd.ToInt64(), Clase = clase.ToString(), Pid = pid, Ancho = r.R - r.L, Alto = r.B - r.T });
            return true;
        }, IntPtr.Zero);
        return lista;
    }

    static bool EsDeLaCopia(HashSet<uint> pids) {
        uint pid;
        GetWindowThreadProcessId(GetForegroundWindow(), out pid);
        return pids.Contains(pid);
    }

    // Las flechas, Inicio, Fin, RePag, AvPag, Insert y Supr son teclas extendidas: sin la marca,
    // Windows las toma por las del teclado numerico, que con BloqNum escriben cifras.
    static uint Extendida(byte vk) { return (vk >= 0x21 && vk <= 0x28) || vk == 0x2D || vk == 0x2E ? 1u : 0u; }

    // Devuelve "" si pulso, o el motivo por el que no.
    public static string Pulsar(IntPtr hwnd, HashSet<uint> pids, byte[] teclas) {
        IntPtr antes = GetForegroundWindow();
        if (!EsDeLaCopia(pids)) {
            // Windows solo deja traer una ventana delante a quien ya tiene la entrada: se comparte
            // la cola de entrada con la ventana de delante el instante que dura la llamada.
            uint otroPid;
            uint hiloDelante = GetWindowThreadProcessId(antes, out otroPid);
            uint yo = GetCurrentThreadId();
            AttachThreadInput(yo, hiloDelante, true);
            BringWindowToTop(hwnd);
            SetForegroundWindow(hwnd);
            AttachThreadInput(yo, hiloDelante, false);
            Thread.Sleep(300);
        }
        if (!EsDeLaCopia(pids)) return "Windows no dejo poner delante la ventana de la copia";

        int pulsadas = 0;
        try {
            foreach (byte vk in teclas) {
                if (!EsDeLaCopia(pids)) return "la ventana de la copia dejo de estar delante";
                keybd_event(vk, 0, Extendida(vk), UIntPtr.Zero);
                pulsadas++;
                Thread.Sleep(30);
            }
        } finally {
            // Se sueltan siempre, y en orden inverso: una tecla que se queda pulsada es de todos.
            for (int i = pulsadas - 1; i >= 0; i--) keybd_event(teclas[i], 0, 2 | Extendida(teclas[i]), UIntPtr.Zero);
        }
        return "";
    }
}
"@

# El proceso y todos sus descendientes.
$todos = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId
$pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
[void]$pids.Add([uint32]$IdProceso)
do {
    $nuevos = 0
    foreach ($p in $todos) {
        if ($pids.Contains([uint32]$p.ParentProcessId) -and $pids.Add([uint32]$p.ProcessId)) { $nuevos++ }
    }
} while ($nuevos -gt 0)

$ventanas = [PdkVentana]::Ventanas($pids)

if ($Accion -eq "ventanas") {
    $salida = @($ventanas | ForEach-Object {
        @{ hwnd = $_.Hwnd; clase = $_.Clase; pid = $_.Pid; ancho = $_.Ancho; alto = $_.Alto }
    })
    ConvertTo-Json -Compress -InputObject $salida
    exit 0
}

# La ventana de la app: la mas grande de las del proceso principal.
$principal = $ventanas | Where-Object { $_.Pid -eq $IdProceso } |
    Sort-Object { $_.Ancho * $_.Alto } -Descending | Select-Object -First 1
if (-not $principal) {
    ConvertTo-Json -Compress -InputObject @{ ok = $false; motivo = "la copia no tiene ninguna ventana visible" }
    exit 0
}

$codigos = [byte[]]@($Teclas -split "," | Where-Object { $_ -ne "" } | ForEach-Object { [byte]$_ })
$motivo = [PdkVentana]::Pulsar([IntPtr]$principal.Hwnd, $pids, $codigos)
ConvertTo-Json -Compress -InputObject @{ ok = ($motivo -eq ""); motivo = $motivo }
