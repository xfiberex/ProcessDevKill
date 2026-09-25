import { invoke } from "@tauri-apps/api/core";
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { catalogoVigente, Marcado } from "../i18n";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Lo que se ve cuando el render revienta.
 *
 * Sin esto, React desmonta el arbol entero ante un error no capturado. En el navegador eso se ve
 * en la consola y uno recarga; **aqui es una ventana de escritorio en release, sin devtools y sin
 * consola** —el binario se compila con `windows_subsystem = "windows"`, asi que ni los `eprintln!`
 * de Rust tienen a donde ir—. El usuario se queda mirando un rectangulo vacio y su unica salida es
 * cerrar la app, sin saber si perdio algo. Basta un dato inesperado de Rust para llegar ahi.
 *
 * Sigue siendo una clase porque React no da equivalente en hooks: `getDerivedStateFromError` y
 * `componentDidCatch` no tienen version funcional. Es el unico componente de clase del proyecto.
 *
 * No intenta recuperarse sola: reintentar el mismo render que acaba de fallar suele volver a
 * fallar. Ofrece **recargar la ventana**, que es lo que de verdad arregla un estado corrupto, y
 * enseña el error para poder copiarlo en un issue.
 *
 * Sus textos salen de `catalogoVigente()` y no de `useT()`: al vivir fuera de `App` esta tambien
 * fuera del proveedor de idioma, asi que el contexto le daria siempre el español. Ver el
 * comentario de `vigente` en `i18n.tsx`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A la consola del webview: en `tauri dev` se ve.
    console.error("Error no capturado en el render:", error, info.componentStack);

    // Y al log en archivo, que es lo unico que queda en release. `catch` vacio a proposito: si el
    // puente con Rust es justo lo que ha fallado, esta llamada tambien fallara, y entonces lo que
    // el usuario necesita ver es la pantalla de error — no un fallo encima del fallo.
    invoke("log_error", {
      mensaje: `${error.message}\n${info.componentStack ?? "sin pila"}`,
    }).catch(() => {});
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const t = catalogoVigente();

    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center"
      >
        <div>
          <h1 className="font-heading text-lg font-semibold">{t.error.titulo}</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            <Marcado texto={t.error.cuerpo} />
          </p>
        </div>

        {/* `select-text`: esta pantalla dice existir para copiar el error en un issue, y con el
            `user-select: none` global de `index.css` no se podía seleccionar (Tier 11, E). */}
        <pre className="max-h-40 max-w-full overflow-auto rounded-md bg-muted px-3 py-2 text-left font-mono text-xs whitespace-pre-wrap text-muted-foreground select-text">
          {error.message || String(error)}
        </pre>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t.error.recargar}
        </button>
      </div>
    );
  }
}
