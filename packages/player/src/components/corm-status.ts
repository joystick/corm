import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("corm-status")
export class CormStatus extends LitElement {
  static override styles = css`
    :host {
      display: block;
      padding: 0.25rem 1rem;
      background: var(--corm-bg, #ffffff);
      border-top: 1px solid hsl(0 0% 89.8%);
    }

    .status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--corm-text, hsl(0 0% 3.9%));
      opacity: 0.6;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: hsl(142 71% 45%);
    }

    :host([status="offline"]) .dot {
      background: hsl(0 84% 60%);
    }
  `;

  @property({ reflect: true })
  declare status: "online" | "offline";

  constructor() {
    super();
    this.status = "online";
  }

  override render() {
    const label = this.status === "online" ? "Online" : "Offline";
    return html`
      <div class="status">
        <span class="dot"></span>
        <span>${label}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "corm-status": CormStatus;
  }
}
