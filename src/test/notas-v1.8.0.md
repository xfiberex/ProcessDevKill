## ProcessDevKill v1.8.0

Gestor de procesos de desarrollo para Windows: lista los `node`, `python` y `dotnet` activos con su CPU, su RAM y **el puerto local que ocupa cada uno**, y permite cerrarlos de uno en uno o en lote.

Esta versión es de **pulido**: cosas pequeñas que se notan cada día. Buscar más rápido, un historial que se lee de un vistazo, texto que se puede copiar y una ventana que se puede ampliar. No cambia ningún permiso ni lo que la app cierra. La auditoría automática de accesibilidad (axe) sigue en **cero fallos** en las cuatro vistas y los dos temas.

---

### 🔎 Buscar sin rodeos

- **<kbd>Ctrl</kbd>+<kbd>F</kbd> lleva al buscador** desde cualquier vista. Antes había que pasar por doce paradas de tabulador para llegar a él.
- **Una × lo borra**, y <kbd>Esc</kbd> también.
- Si ningún proceso coincide, un botón **«Quitar filtro»** quita la búsqueda y el filtro de runtime a la vez.

### 🕘 Un historial que se lee

- **Agrupado por acción**: un Nuke All de quince procesos es ahora **una fila** que dice cuántos eran, de qué tipo («dotnet.exe ×4») y qué puertos liberaron. Se despliega para ver cada proceso.
- **La hora, como se recuerda**: «hace 5 minutos», «ayer», «16 sept». La hora exacta sale al pasar el ratón.

### 📋 Se puede copiar

- **El texto de las tablas se puede seleccionar** —nombres, PID, puertos, servicios—, y también el error de la pantalla de fallo, que existe justo para pegarlo en un issue.

### 🔍 Zoom

- **<kbd>Ctrl</kbd>+<kbd>+</kbd> y <kbd>Ctrl</kbd>+<kbd>-</kbd> amplían y reducen la ventana**, y <kbd>Ctrl</kbd>+<kbd>0</kbd> la devuelve a su tamaño. Si la tabla no cabe, hace scroll horizontal en vez de esconder el nombre del proceso.

### ✨ Detalles

- **Refrescar es un icono** mientras la lista se refresca sola, y vuelve con su texto con el auto-refresco en «Off».
- **La tabla deja sitio debajo** para que un aviso no tape el Kill de la última fila.
- **El menú de cada fila se abre con el teclado**: <kbd>Shift</kbd>+<kbd>F10</kbd> o la tecla Menú, desde la casilla o el Kill de la fila. Ya se podía, pero la documentación decía lo contrario.
- Los textos del medidor pasan de 11 a 12 px, y hay algunas tildes y erratas corregidas.

---

### Descarga

| Archivo | Para qué |
|---|---|
| `ProcessDevKill_1.8.0_x64-setup.exe` | Instalador recomendado (NSIS). Se instala para el usuario actual, sin pedir permisos de administrador. |
| `ProcessDevKill_1.8.0_x64_en-US.msi` | Instalador MSI, para despliegue por directiva de grupo o quien lo prefiera. |

Los `.sha256` son el hash de cada instalador, por si quieres verificar la descarga:

```powershell
Get-FileHash .\ProcessDevKill_1.8.0_x64-setup.exe -Algorithm SHA256
```

### Aviso de SmartScreen

Los instaladores no están firmados, así que la primera vez Windows mostrará el aviso de SmartScreen (*Windows protegió su PC*): **Más información → Ejecutar de todas formas**.

Requiere Windows 10/11 con WebView2 (incluido de serie en Windows 11).

