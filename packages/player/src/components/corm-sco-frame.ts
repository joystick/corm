import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";

/**
 * Incoming postMessage shape from a cross-origin SCO.
 */
interface ScormCallMessage {
  type: "scorm-call";
  method: string;
  args: string[];
  callId?: string;
}

/**
 * `<corm-sco-frame>` renders a vendor SCO inside a sandboxed iframe
 * and wires up the SCORM API shim on the iframe's `contentWindow`.
 *
 * For same-origin SCOs the shim objects (`API` / `API_1484_11`) are
 * injected directly.  For cross-origin SCOs a `postMessage` bridge
 * relays SCORM calls back to the player.
 */
@customElement("corm-sco-frame")
export class CormScoFrame extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  `;

  /** URL to the SCO HTML entry point. */
  @property()
  declare src: string;

  /** Course identifier — passed through to the SCORM shim. */
  @property({ attribute: "course-id" })
  declare courseId: string;

  /** Learner identifier — passed through to the SCORM shim. */
  @property({ attribute: "learner-id" })
  declare learnerId: string;

  @query("iframe")
  declare private _iframe: HTMLIFrameElement;

  /** Bound listener reference for cleanup. */
  private _messageHandler: ((e: MessageEvent) => void) | null = null;

  constructor() {
    super();
    this.src = "";
    this.courseId = "";
    this.learnerId = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._messageHandler = this._handleMessage.bind(this);
    globalThis.addEventListener("message", this._messageHandler);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._messageHandler) {
      globalThis.removeEventListener("message", this._messageHandler);
      this._messageHandler = null;
    }
  }

  /**
   * Attempt to inject the SCORM API shim into the iframe's window.
   * This only works for same-origin SCOs — cross-origin will throw
   * and fall back to the postMessage bridge.
   */
  private _onIframeLoad(): void {
    try {
      const win = this._iframe?.contentWindow;
      if (!win) return;

      // Try accessing the document to verify same-origin
      // deno-lint-ignore no-unused-vars
      const _doc = win.document;

      // Install shim objects.  The shim module may not be loaded yet
      // (it's being built by another agent), so we set up stub objects
      // that the real shim can enhance later.
      if (!(win as Record<string, unknown>)["API"]) {
        (win as Record<string, unknown>)["API"] = this._createScormStub("1.2");
      }
      if (!(win as Record<string, unknown>)["API_1484_11"]) {
        (win as Record<string, unknown>)["API_1484_11"] = this._createScormStub(
          "2004",
        );
      }

      this.dispatchEvent(
        new CustomEvent("sco-loaded", {
          bubbles: true,
          composed: true,
          detail: { origin: "same-origin" },
        }),
      );
    } catch {
      // Cross-origin — rely on postMessage bridge
      this.dispatchEvent(
        new CustomEvent("sco-loaded", {
          bubbles: true,
          composed: true,
          detail: { origin: "cross-origin" },
        }),
      );
    }
  }

  /**
   * Handle postMessage calls from cross-origin SCOs.
   */
  private _handleMessage(e: MessageEvent): void {
    if (!e.data || e.data.type !== "scorm-call") return;

    const msg = e.data as ScormCallMessage;

    // Process the SCORM call — for now return sensible defaults.
    // The real implementation will delegate to the CmiRuntime.
    const result = this._processScormCall(msg.method, msg.args);

    // Respond back to the SCO
    const source = e.source as Window | null;
    if (source) {
      source.postMessage(
        {
          type: "scorm-response",
          method: msg.method,
          result,
          callId: msg.callId,
        },
        e.origin === "null" ? "*" : e.origin,
      );
    }
  }

  /**
   * Process a SCORM API call and return a result string.
   * This is a placeholder — the bridge / CmiRuntime integration
   * will replace these stubs.
   */
  private _processScormCall(method: string, _args: string[]): string {
    switch (method) {
      case "LMSInitialize":
      case "Initialize":
        return "true";
      case "LMSFinish":
      case "Terminate":
        return "true";
      case "LMSGetValue":
      case "GetValue":
        return "";
      case "LMSSetValue":
      case "SetValue":
        return "true";
      case "LMSCommit":
      case "Commit":
        return "true";
      case "LMSGetLastError":
      case "GetLastError":
        return "0";
      case "LMSGetErrorString":
      case "GetErrorString":
        return "No Error";
      case "LMSGetDiagnostic":
      case "GetDiagnostic":
        return "";
      default:
        return "";
    }
  }

  /**
   * Create a minimal SCORM API stub object.
   */
  private _createScormStub(
    _version: "1.2" | "2004",
  ): Record<string, (...args: string[]) => string> {
    return {
      LMSInitialize: () => this._processScormCall("LMSInitialize", []),
      LMSFinish: () => this._processScormCall("LMSFinish", []),
      LMSGetValue: (key: string) =>
        this._processScormCall("LMSGetValue", [key]),
      LMSSetValue: (key: string, val: string) =>
        this._processScormCall("LMSSetValue", [key, val]),
      LMSCommit: () => this._processScormCall("LMSCommit", []),
      LMSGetLastError: () => this._processScormCall("LMSGetLastError", []),
      LMSGetErrorString: (code: string) =>
        this._processScormCall("LMSGetErrorString", [code]),
      LMSGetDiagnostic: (code: string) =>
        this._processScormCall("LMSGetDiagnostic", [code]),
      // SCORM 2004 aliases
      Initialize: () => this._processScormCall("Initialize", []),
      Terminate: () => this._processScormCall("Terminate", []),
      GetValue: (key: string) => this._processScormCall("GetValue", [key]),
      SetValue: (key: string, val: string) =>
        this._processScormCall("SetValue", [key, val]),
      Commit: () => this._processScormCall("Commit", []),
      GetLastError: () => this._processScormCall("GetLastError", []),
      GetErrorString: (code: string) =>
        this._processScormCall("GetErrorString", [code]),
      GetDiagnostic: (code: string) =>
        this._processScormCall("GetDiagnostic", [code]),
    };
  }

  override render() {
    return html`
      <iframe
        src="${this.src}"
        sandbox="allow-scripts allow-same-origin allow-forms"
        @load="${this._onIframeLoad}"
      ></iframe>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "corm-sco-frame": CormScoFrame;
  }
}
