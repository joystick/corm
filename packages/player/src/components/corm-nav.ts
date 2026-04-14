import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { cormTheme } from "../styles/theme.ts";

@customElement("corm-nav")
export class CormNav extends LitElement {
  static override styles = [
    cormTheme,
    css`
      :host {
        display: block;
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding: var(--corm-space-3) var(--corm-space-4);
      }

      .nav-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--corm-space-4);
      }

      h1 {
        margin: 0;
        font-size: var(--corm-font-size-lg);
        font-weight: 600;
        color: var(--corm-foreground);
      }

      .progress-bar {
        flex: 1;
        max-width: 200px;
        height: 6px;
        background: var(--corm-muted);
        border-radius: var(--corm-radius);
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: var(--corm-primary);
        border-radius: var(--corm-radius);
        transition: width 0.3s ease;
      }
    `,
  ];

  @property()
  declare title: string;

  @property({ type: Number })
  declare progress: number;

  constructor() {
    super();
    this.title = "";
    this.progress = 0;
  }

  override render() {
    const clampedProgress = Math.max(0, Math.min(100, this.progress));
    return html`
      <div class="nav-bar">
        <h1>${this.title}</h1>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow="${clampedProgress}"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Course progress"
        >
          <div class="progress-fill" style="width: ${clampedProgress}%"></div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "corm-nav": CormNav;
  }
}
