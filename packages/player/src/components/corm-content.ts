import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("corm-content")
export class CormContent extends LitElement {
  static override styles = css`
    :host {
      display: block;
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem 2rem;
      color: var(--corm-text, hsl(0 0% 3.9%));
      background: var(--corm-bg, #ffffff);
      font-size: 1rem;
      line-height: 1.75;
    }

    .content-area {
      max-width: 65ch;
      margin: 0 auto;
    }

    .rejection-message {
      max-width: 65ch;
      margin: 2rem auto;
      padding: 1rem 1.5rem;
      background: hsl(0 0% 96%);
      border: 1px solid hsl(0 0% 89.8%);
      border-radius: var(--corm-radius, 0.5rem);
      color: hsl(0 0% 25%);
      font-size: 0.9375rem;
      line-height: 1.5;
    }
  `;

  @property()
  declare content: string;

  @property({ attribute: "rejection-message" })
  declare rejectionMessage: string;

  constructor() {
    super();
    this.content = "";
    this.rejectionMessage = "";
  }

  override render() {
    if (this.rejectionMessage) {
      return html`
        <div class="rejection-message">${this.rejectionMessage}</div>
      `;
    }
    return html`
      <div class="content-area" .innerHTML="${this.content}"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "corm-content": CormContent;
  }
}
