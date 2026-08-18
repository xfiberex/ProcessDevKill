import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

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
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A la consola del webview: en `tauri dev` se ve, y en release no hay donde mirar todavia.
    // Cuando exista el log en archivo (T2-03) este es el sitio desde el que llamarlo.
    console.error("Error no capturado en el render:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center"
      >
        <div>
          <h1 className="font-heading text-lg font-semibold">
            La ventana ha fallado
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Algo se ha roto al pintar la interfaz.{" "}
            <strong className="font-medium text-foreground">
              Ningún proceso se ha cerrado
            </strong>{" "}
            por esto, y tus ajustes y tu historial siguen en su sitio.
          </p>
        </div>

        <pre className="max-h-40 max-w-full overflow-auto rounded-md bg-muted px-3 py-2 text-left font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          {error.message || String(error)}
        </pre>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Recargar la ventana
        </button>
      </div>
    );
  }
}
