import { css } from "lit";

/**
 * Core CORM theme — bridges shadcn/ui CSS custom properties from a host app
 * (e.g. seaducate.com) with fallbacks to the seaducate navy+gold+cyan palette.
 *
 * Every component adopts this as the first entry in `static styles`.
 */
export const cormTheme = css`
  :host {
    /* Bridge: inherit from shadcn host, fall back to seaducate.com defaults */
    --corm-primary: var(--primary, hsl(36 100% 58%));
    --corm-primary-foreground: var(--primary-foreground, hsl(0 0% 100%));
    --corm-secondary: var(--secondary, hsl(187 79% 43%));
    --corm-secondary-foreground: var(--secondary-foreground, hsl(0 0% 100%));
    --corm-background: var(--background, hsl(217 39% 14%));
    --corm-foreground: var(--foreground, hsl(0 0% 98%));
    --corm-card: var(--card, hsl(217 33% 17%));
    --corm-card-foreground: var(--card-foreground, hsl(0 0% 98%));
    --corm-muted: var(--muted, hsl(217 33% 20%));
    --corm-muted-foreground: var(--muted-foreground, hsl(215 20% 65%));
    --corm-destructive: var(--destructive, hsl(0 84% 60%));
    --corm-border: var(--border, hsl(217 33% 25%));
    --corm-input: var(--input, hsl(217 33% 25%));
    --corm-ring: var(--ring, hsl(36 100% 58%));
    --corm-radius: var(--radius, 0.75rem);

    /* Typography */
    --corm-font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
    --corm-font-size-sm: 0.875rem;
    --corm-font-size-base: 1rem;
    --corm-font-size-lg: 1.125rem;
    --corm-font-size-xl: 1.25rem;

    /* Spacing */
    --corm-space-1: 0.25rem;
    --corm-space-2: 0.5rem;
    --corm-space-3: 0.75rem;
    --corm-space-4: 1rem;
    --corm-space-6: 1.5rem;
    --corm-space-8: 2rem;
  }
`;

/** Card primitives — solid and glass-morphism variants. */
export const cormCard = css`
  .corm-card {
    background: var(--corm-card);
    color: var(--corm-card-foreground);
    border: 1px solid var(--corm-border);
    border-radius: var(--corm-radius);
  }

  .corm-card-glass {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--corm-radius);
  }
`;

/** Button primitives matching shadcn variant conventions. */
export const cormButton = css`
  .corm-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--corm-space-2) var(--corm-space-4);
    border-radius: var(--corm-radius);
    font-size: var(--corm-font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    outline: none;
  }

  .corm-btn:focus-visible {
    box-shadow: 0 0 0 2px var(--corm-background), 0 0 0 4px var(--corm-ring);
  }

  .corm-btn-primary {
    background: var(--corm-primary);
    color: var(--corm-primary-foreground);
  }

  .corm-btn-primary:hover {
    opacity: 0.9;
  }

  .corm-btn-secondary {
    background: var(--corm-secondary);
    color: var(--corm-secondary-foreground);
  }

  .corm-btn-outline {
    background: transparent;
    color: var(--corm-foreground);
    border: 1px solid var(--corm-border);
  }

  .corm-btn-outline:hover {
    background: var(--corm-muted);
  }

  .corm-btn-ghost {
    background: transparent;
    color: var(--corm-foreground);
  }

  .corm-btn-ghost:hover {
    background: var(--corm-muted);
  }

  .corm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
