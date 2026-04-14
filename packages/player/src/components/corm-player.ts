import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { renderMarkdown } from "../renderer.ts";
import { resolveContent } from "../content/mod.ts";
import type { ContentType } from "../content/mod.ts";
import { CmiRuntime } from "../cmi/runtime.ts";
import { type Bridge, createBridge } from "../bridge.ts";
import { type CormStore, createCormStore } from "../store/store.ts";
import {
  type Activity,
  allLeaves,
  buildActivityTree,
  type ManifestOrganization,
  SequencingEngine,
} from "../sequencing/mod.ts";
import { cormTheme } from "../styles/theme.ts";
import type { ChoiceMenuItem } from "./corm-controls.ts";
import "./corm-nav.ts";
import "./corm-content.ts";
import "./corm-controls.ts";
import "./corm-status.ts";

interface CormManifest {
  metadata?: { title?: string };
  organizations: ManifestOrganization[];
}

@customElement("corm-player")
export class CormPlayer extends LitElement {
  static override styles = [
    cormTheme,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 400px;
        background: var(--corm-background);
        color: var(--corm-foreground);
        font-family: var(--corm-font-family);
        border: 1px solid var(--corm-border);
        border-radius: var(--corm-radius);
        overflow: hidden;
      }

      corm-content {
        flex: 1;
      }
    `,
  ];

  @property({ attribute: "course-id" })
  declare courseId: string;

  @property({ attribute: "learner-id" })
  declare learnerId: string;

  @property({ attribute: "learner-name" })
  declare learnerName: string;

  @property({ attribute: "manifest-url" })
  declare manifestUrl: string;

  @state()
  private _manifest: CormManifest | null = null;

  @state()
  private _currentActivity: Activity | null = null;

  @state()
  private _availableActivities: ChoiceMenuItem[] = [];

  @state()
  private _completionPercentage = 0;

  @state()
  private _canGoNext = false;

  @state()
  private _canGoPrev = false;

  @state()
  private _contentType: ContentType = "markdown";

  @state()
  private _scoUrl = "";

  @state()
  private _rejectionMessage = "";

  @state()
  private _choiceEnabled = false;

  private _store: CormStore | null = null;
  private _runtime: CmiRuntime | null = null;
  private _bridge: Bridge | null = null;
  private _engine: SequencingEngine | null = null;
  private _activityTree: Activity[] = [];

  constructor() {
    super();
    this.courseId = "";
    this.learnerId = "";
    this.learnerName = "";
    this.manifestUrl = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.manifestUrl) {
      this._loadManifest();
    }
    if (this.learnerId && this.courseId) {
      this._initializeBridge();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._bridge?.dispose();
  }

  private async _initializeBridge(): Promise<void> {
    try {
      this._store = await createCormStore();
      this._runtime = new CmiRuntime();
      this._runtime.initialize(
        this.learnerId,
        this.learnerName || this.learnerId,
      );

      this._bridge = await createBridge({
        store: this._store,
        runtime: this._runtime,
        learnerId: this.learnerId,
        courseId: this.courseId,
      });
      await this._bridge.initialize();

      // If manifest already loaded, wire up the engine
      if (this._manifest) {
        this._initializeEngine();
      }
    } catch (err) {
      console.error("[corm-player] Failed to initialize bridge:", err);
    }
  }

  private async _loadManifest(): Promise<void> {
    try {
      const res = await fetch(this.manifestUrl);
      const manifest: CormManifest = await res.json();
      this._manifest = manifest;

      // Build activity tree and engine
      this._initializeEngine();
    } catch (err) {
      console.error("[corm-player] Failed to load manifest:", err);
    }
  }

  private _initializeEngine(): void {
    if (!this._manifest) return;

    const runtime = this._runtime ?? new CmiRuntime();
    if (!this._runtime) {
      runtime.initialize("anonymous", "Anonymous");
      this._runtime = runtime;
    }

    this._activityTree = buildActivityTree(this._manifest.organizations);
    this._engine = new SequencingEngine(this._activityTree, runtime);

    // Resume from lesson_location if available
    const savedLocation = runtime.getValue("cmi.core.lesson_location");
    if (savedLocation) {
      // Try choice navigation to the saved activity
      const result = this._engine.navigate("choice", savedLocation);
      if (result.delivered) {
        this._applyNavigationResult(result);
        return;
      }
    }

    // Default: start from the beginning
    const result = this._engine.navigate("start");
    this._applyNavigationResult(result);
  }

  /** Apply a navigation result to reactive state. */
  private _applyNavigationResult(result: {
    delivered: Activity | null;
    reason?: string;
    availableActivities: Activity[];
  }): void {
    if (!this._engine) return;

    if (result.delivered) {
      this._currentActivity = result.delivered;
      this._rejectionMessage = "";

      // Track location in CMI
      this._trackLocation(result.delivered.id);
    } else if (result.reason) {
      this._rejectionMessage = result.reason;
    }

    // Update derived state
    this._updateDerivedState(result.availableActivities);
  }

  /** Recompute canGoNext, canGoPrev, availableActivities, completion. */
  private _updateDerivedState(available: Activity[]): void {
    if (!this._engine) return;

    this._completionPercentage = this._engine.getCompletionPercentage();

    // Check if next/prev are possible by examining leaves
    const leaves = allLeaves(this._activityTree);
    const currentIdx = this._currentActivity
      ? leaves.indexOf(this._currentActivity)
      : -1;

    this._canGoNext = currentIdx >= 0 && currentIdx < leaves.length - 1;
    this._canGoPrev = currentIdx > 0;

    // Build choice menu items from all leaves
    const allLeafActivities = allLeaves(this._activityTree);
    this._availableActivities = allLeafActivities.map((a) => ({
      id: a.id,
      title: a.title,
      available: this._engine!.isActivityAvailable(a.id),
    }));

    // Determine if choice navigation is enabled (check any root's control mode)
    this._choiceEnabled = this._availableActivities.length > 1;
  }

  private get _title(): string {
    return this._manifest?.metadata?.title ??
      this._manifest?.organizations?.[0]?.title ??
      "CORM Player";
  }

  private get _currentContent(): string {
    const activity = this._currentActivity;
    if (!activity?.content?.length) return "<p>No content available.</p>";

    const info = resolveContent(activity.content);
    this._contentType = info.type;

    if (info.type === "sco" && info.url) {
      this._scoUrl = info.url;
      return "";
    }

    this._scoUrl = "";
    return renderMarkdown(info.markdown ?? activity.content.join("\n"));
  }

  private _onPrev(): void {
    if (!this._engine) return;
    const result = this._engine.navigate("previous");
    this._applyNavigationResult(result);
  }

  private _onNext(): void {
    if (!this._engine) return;
    const result = this._engine.navigate("continue");
    this._applyNavigationResult(result);
  }

  private _onChoice(e: CustomEvent<{ targetId: string }>): void {
    if (!this._engine) return;
    const result = this._engine.navigate("choice", e.detail.targetId);
    this._applyNavigationResult(result);
  }

  private _trackLocation(activityId: string): void {
    if (this._runtime) {
      try {
        this._runtime.setValue("cmi.core.lesson_location", activityId);
        this._runtime.commit();
      } catch {
        // Runtime may be finished — ignore
      }
    }
  }

  override render() {
    return html`
      <corm-nav
        .title="${this._title}"
        .progress="${this._completionPercentage}"
      ></corm-nav>
      <corm-content
        .content="${this._currentContent}"
        .contentType="${this._contentType}"
        .scoUrl="${this._scoUrl}"
        .courseId="${this.courseId}"
        .learnerId="${this.learnerId}"
        .rejectionMessage="${this._rejectionMessage}"
      ></corm-content>
      <corm-controls
        ?disable-prev="${!this._canGoPrev}"
        ?disable-next="${!this._canGoNext}"
        ?show-choice-menu="${this._choiceEnabled}"
        .availableActivities="${this._availableActivities}"
        @corm-prev="${this._onPrev}"
        @corm-next="${this._onNext}"
        @corm-choice="${this._onChoice}"
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
