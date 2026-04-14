import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ContentType } from "../content/mod.ts";
import { cormTheme } from "../styles/theme.ts";
import "./corm-sco-frame.ts";

@customElement("corm-content")
export class CormContent extends LitElement {
  static override styles = [
    cormTheme,
    css`
      :host {
        display: block;
        flex: 1;
        overflow-y: auto;
        color: var(--corm-foreground);
        background: var(--corm-background);
        font-size: var(--corm-font-size-base);
        line-height: 1.75;
      }

      .content-area {
        max-width: 65ch;
        margin: 0 auto;
        padding: var(--corm-space-6) var(--corm-space-8);
      }

      .rejection-message {
        max-width: 65ch;
        margin: var(--corm-space-8) auto;
        padding: var(--corm-space-4) var(--corm-space-6);
        background: var(--corm-muted);
        border: 1px solid var(--corm-border);
        border-radius: var(--corm-radius);
        color: var(--corm-muted-foreground);
        font-size: var(--corm-font-size-sm);
        line-height: 1.5;
      }

      corm-sco-frame {
        width: 100%;
        height: 100%;
      }
    `,
  ];

  /** Rendered HTML content (for markdown mode). */
  @property()
  declare content: string;

  /** Content type: "markdown" renders HTML, "sco" renders an iframe. */
  @property({ attribute: "content-type" })
  declare contentType: ContentType;

  /** URL of the SCO HTML entry point (used when contentType is "sco"). */
  @property({ attribute: "sco-url" })
  declare scoUrl: string;

  /** Course ID passed through to the SCO frame. */
  @property({ attribute: "course-id" })
  declare courseId: string;

  /** Learner ID passed through to the SCO frame. */
  @property({ attribute: "learner-id" })
  declare learnerId: string;

  @property({ attribute: "rejection-message" })
  declare rejectionMessage: string;

  constructor() {
    super();
    this.content = "";
    this.contentType = "markdown";
    this.scoUrl = "";
    this.courseId = "";
    this.learnerId = "";
    this.rejectionMessage = "";
  }

  override render() {
    if (this.rejectionMessage) {
      return html`
        <div class="rejection-message">${this.rejectionMessage}</div>
      `;
    }

    if (this.contentType === "sco" && this.scoUrl) {
      return html`
        <corm-sco-frame
          .src="${this.scoUrl}"
          .courseId="${this.courseId}"
          .learnerId="${this.learnerId}"
        ></corm-sco-frame>
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
