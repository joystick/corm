import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { renderMarkdown } from "../renderer.ts";
import "./corm-nav.ts";
import "./corm-content.ts";
import "./corm-controls.ts";
import "./corm-status.ts";

interface ManifestItem {
  identifier: string;
  title: string;
  content?: string;
}

interface ManifestOrganization {
  identifier: string;
  title: string;
  items: ManifestItem[];
}

interface CormManifest {
  metadata?: { title?: string };
  organizations: ManifestOrganization[];
}

@customElement("corm-player")
export class CormPlayer extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 400px;
      background: var(--corm-bg, #ffffff);
      color: var(--corm-text, hsl(0 0% 3.9%));
      font-family: system-ui, -apple-system, sans-serif;
      border: 1px solid hsl(0 0% 89.8%);
      border-radius: var(--corm-radius, 0.5rem);
      overflow: hidden;
    }

    corm-content {
      flex: 1;
    }
  `;

  @property({ attribute: "course-id" })
  declare courseId: string;

  @property({ attribute: "learner-id" })
  declare learnerId: string;

  @property({ attribute: "manifest-url" })
  declare manifestUrl: string;

  @state()
  private _manifest: CormManifest | null = null;

  @state()
  private _currentIndex = 0;

  @state()
  private _items: ManifestItem[] = [];

  constructor() {
    super();
    this.courseId = "";
    this.learnerId = "";
    this.manifestUrl = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.manifestUrl) {
      this._loadManifest();
    }
  }

  private async _loadManifest(): Promise<void> {
    try {
      const res = await fetch(this.manifestUrl);
      const manifest: CormManifest = await res.json();
      this._manifest = manifest;

      const org = manifest.organizations?.[0];
      this._items = org?.items ?? [];
      this._currentIndex = 0;
    } catch (err) {
      console.error("[corm-player] Failed to load manifest:", err);
    }
  }

  private get _title(): string {
    return this._manifest?.metadata?.title ??
      this._manifest?.organizations?.[0]?.title ??
      "CORM Player";
  }

  private get _progress(): number {
    if (this._items.length === 0) return 0;
    return Math.round(((this._currentIndex + 1) / this._items.length) * 100);
  }

  private get _currentContent(): string {
    const item = this._items[this._currentIndex];
    if (!item?.content) return "<p>No content available.</p>";
    return renderMarkdown(item.content);
  }

  private _onPrev(): void {
    if (this._currentIndex > 0) {
      this._currentIndex--;
    }
  }

  private _onNext(): void {
    if (this._currentIndex < this._items.length - 1) {
      this._currentIndex++;
    }
  }

  override render() {
    return html`
      <corm-nav
        .title="${this._title}"
        .progress="${this._progress}"
      ></corm-nav>
      <corm-content .content="${this._currentContent}"></corm-content>
      <corm-controls
        ?disable-prev="${this._currentIndex === 0}"
        ?disable-next="${this._currentIndex >= this._items.length - 1}"
        @corm-prev="${this._onPrev}"
        @corm-next="${this._onNext}"
      ></corm-controls>
      <corm-status></corm-status>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "corm-player": CormPlayer;
  }
}
