import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("corm-controls")
export class CormControls extends LitElement {
  static override styles = css`
    :host {
      display: block;
      background: var(--corm-bg, #ffffff);
      border-top: 1px solid hsl(0 0% 89.8%);
      padding: 0.75rem 1rem;
    }

    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 65ch;
      margin: 0 auto;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border: 1px solid hsl(0 0% 89.8%);
      border-radius: var(--corm-radius, 0.5rem);
      background: var(--corm-bg, #ffffff);
      color: var(--corm-text, hsl(0 0% 3.9%));
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    button:hover:not(:disabled) {
      background: hsl(0 0% 95.1%);
      border-color: hsl(0 0% 79.8%);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  @property({ type: Boolean, attribute: "disable-prev" })
  declare disablePrev: boolean;

  @property({ type: Boolean, attribute: "disable-next" })
  declare disableNext: boolean;

  constructor() {
    super();
    this.disablePrev = false;
    this.disableNext = false;
  }

  private _onPrev() {
    this.dispatchEvent(
      new CustomEvent("corm-prev", { bubbles: true, composed: true }),
    );
  }

  private _onNext() {
    this.dispatchEvent(
      new CustomEvent("corm-next", { bubbles: true, composed: true }),
    );
  }

  override render() {
    return html`
      <div class="controls">
        <button ?disabled="${this.disablePrev}" @click="${this._onPrev}">
          Previous
        </button>
        <button ?disabled="${this.disableNext}" @click="${this._onNext}">
          Next
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "corm-controls": CormControls;
  }
}
