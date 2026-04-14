import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("corm-nav")
export class CormNav extends LitElement {
  static override styles = css`
    :host {
      display: block;
      background: var(--corm-bg, #ffffff);
      border-bottom: 1px solid hsl(0 0% 89.8%);
      padding: 0.75rem 1rem;
    }

    .nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    h1 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--corm-text, hsl(0 0% 3.9%));
    }

    .progress-bar {
      flex: 1;
      max-width: 200px;
      height: 6px;
      background: hsl(0 0% 89.8%);
      border-radius: var(--corm-radius, 0.5rem);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--corm-primary, hsl(0 0% 9%));
      border-radius: var(--corm-radius, 0.5rem);
      transition: width 0.3s ease;
    }
  `;

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
