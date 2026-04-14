import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { cormTheme } from "../styles/theme.ts";

@customElement("corm-status")
export class CormStatus extends LitElement {
  static override styles = [
    cormTheme,
    css`
      :host {
        display: block;
        padding: var(--corm-space-1) var(--corm-space-4);
        background: var(--corm-card);
        border-top: 1px solid var(--corm-border);
      }

      .status {
        display: flex;
        align-items: center;
        gap: var(--corm-space-2);
        font-size: 0.75rem;
        color: var(--corm-muted-foreground);
      }

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--corm-secondary);
      }

      :host([status="offline"]) .dot {
        background: var(--corm-destructive);
      }
    `,
  ];

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
