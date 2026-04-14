import { css, html, LitElement } from "lit";
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
  `;

  @property()
  declare content: string;

  constructor() {
    super();
    this.content = "";
  }

  override render() {
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
