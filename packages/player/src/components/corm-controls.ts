import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { cormButton, cormTheme } from "../styles/theme.ts";

export interface ChoiceMenuItem {
  id: string;
  title: string;
  available: boolean;
}

@customElement("corm-controls")
export class CormControls extends LitElement {
  static override styles = [
    cormTheme,
    cormButton,
    css`
      :host {
        display: block;
        background: var(--corm-card);
        border-top: 1px solid var(--corm-border);
        padding: var(--corm-space-3) var(--corm-space-4);
      }

      .controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 65ch;
        margin: 0 auto;
        position: relative;
      }

      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--corm-space-2);
        padding: var(--corm-space-2) var(--corm-space-4);
        border: 1px solid var(--corm-border);
        border-radius: var(--corm-radius);
        background: transparent;
        color: var(--corm-foreground);
        font-size: var(--corm-font-size-sm);
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease;
      }

      button:hover:not(:disabled) {
        background: var(--corm-muted);
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .menu-container {
        position: relative;
      }

      .choice-menu {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        min-width: 200px;
        max-height: 300px;
        overflow-y: auto;
        background: var(--corm-card);
        border: 1px solid var(--corm-border);
        border-radius: var(--corm-radius);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        margin-bottom: var(--corm-space-2);
        padding: var(--corm-space-1);
        z-index: 10;
      }

      .choice-item {
        display: block;
        width: 100%;
        padding: var(--corm-space-2) var(--corm-space-3);
        border: none;
        background: transparent;
        color: var(--corm-foreground);
        font-size: var(--corm-font-size-sm);
        text-align: left;
        cursor: pointer;
        border-radius: calc(var(--corm-radius) - 2px);
      }

      .choice-item:hover:not(:disabled) {
        background: var(--corm-primary);
        color: var(--corm-primary-foreground);
      }

      .choice-item:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        color: var(--corm-muted-foreground);
      }
    `,
  ];

  @property({ type: Boolean, attribute: "disable-prev" })
  declare disablePrev: boolean;

  @property({ type: Boolean, attribute: "disable-next" })
  declare disableNext: boolean;

  @property({ type: Boolean, attribute: "show-choice-menu" })
  declare showChoiceMenu: boolean;

  @property({ type: Array })
  declare availableActivities: ChoiceMenuItem[];

  @state()
  private _menuOpen = false;

  constructor() {
    super();
    this.disablePrev = false;
    this.disableNext = false;
    this.showChoiceMenu = false;
    this.availableActivities = [];
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

  private _toggleMenu() {
    this._menuOpen = !this._menuOpen;
  }

  private _onChoice(targetId: string) {
    this._menuOpen = false;
    this.dispatchEvent(
      new CustomEvent("corm-choice", {
        bubbles: true,
        composed: true,
        detail: { targetId },
      }),
    );
  }

  private _renderMenu() {
    if (!this._menuOpen || this.availableActivities.length === 0) {
      return nothing;
    }
    return html`
      <div class="choice-menu">
        ${this.availableActivities.map(
          (item) =>
            html`
              <button
                class="choice-item"
                ?disabled="${!item.available}"
                @click="${() => item.available && this._onChoice(item.id)}"
              >
                ${item.available ? "" : "\uD83D\uDD12 "}${item.title}
              </button>
            `,
        )}
      </div>
    `;
  }

  override render() {
    return html`
      <div class="controls">
        <button ?disabled="${this.disablePrev}" @click="${this._onPrev}">
          Previous
        </button>
        ${this.showChoiceMenu
          ? html`
            <div class="menu-container">
              ${this._renderMenu()}
              <button @click="${this._toggleMenu}">Menu</button>
            </div>
          `
          : nothing}
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
