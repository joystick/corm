# Shipping One TypeScript Codebase as Both Deno and npm Packages

*Lessons from building CORM — a 10-package Deno monorepo that ships two npm packages to a Node.js/React app.*

## The Setup

CORM is a SCORM replacement for maritime training delivery. The codebase is a Deno monorepo with 10 packages: schemas, parsers, a transpilation lens, a Lit web component player, and a CLI. Two of these packages need to work in a Node.js app (seaducate.com, a Hono/React/Vite stack):

- **@corm/player** — Lit web components consumed by the React frontend
- **@corm/transpiler** — SCORM→CORM conversion used in the Hono backend

The rest stay Deno-only. This article covers what worked, what didn't, and the patterns that emerged.

## What Actually Works: The Happy Path

Most TypeScript is runtime-agnostic. If your code uses standard APIs (Web Crypto, fetch, URL, TextEncoder), it runs everywhere. Our schema package (Effect.ts types), lens (pure data transformation), and validator (schema checks) needed zero changes for cross-runtime use.

The pattern for dual-target packages:

```
packages/player/
  deno.json          # Deno workspace member, dev/test config
  package.json       # npm package metadata, build scripts
  vite.config.ts     # Library-mode build → dist/
  tsconfig.build.json # Declaration generation
  src/               # Shared source (works in both runtimes)
  tests/             # Deno tests (deno test)
  dist/              # npm build output (gitignored)
```

**deno.json** handles development — imports, linting, formatting, testing:

```json
{
  "name": "@corm/player",
  "version": "0.1.0",
  "exports": "./src/mod.ts",
  "imports": {
    "lit": "npm:lit@^3.2.0",
    "marked": "npm:marked@^15.0.0",
    "@std/assert": "jsr:@std/assert@^1.0.0"
  }
}
```

**package.json** handles distribution — dependencies, build, npm publish:

```json
{
  "name": "@corm/player",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./cmi": { "import": "./dist/cmi/index.js" },
    "./sequencing": { "import": "./dist/sequencing/index.js" }
  },
  "scripts": {
    "build": "vite build && tsc -p tsconfig.build.json"
  },
  "dependencies": {
    "lit": "^3.2.0",
    "marked": "^15.0.0"
  }
}
```

These two files describe the same package for different audiences. Deno reads `deno.json`, npm reads `package.json`. Source files are shared — you write once, test in Deno, build for npm.

## Vite as the Bridge

Vite's library mode is the key enabler. It resolves Deno-style `.ts` extension imports, bundles internal modules, and externalizes dependencies:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/mod.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      external: ["lit", "marked", /^rxdb/],
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
      },
    },
  },
});
```

`preserveModules: true` keeps the directory structure in `dist/`, which makes subpath exports work. Without it, Vite would flatten everything into a single bundle and you'd lose tree-shaking.

The `.ts` extension imports that Deno requires (`import { foo } from "./bar.ts"`) work in Vite out of the box — Vite strips the extension during bundling.

## What Doesn't Work: Platform-Specific Dependencies

Here's where the "same codebase" story breaks down.

Our SCORM parser uses `deno-dom` — a Deno-specific DOM parser. It doesn't exist on npm, and its API has quirks that don't map 1:1 to Node.js alternatives:

| Feature | deno-dom | @xmldom/xmldom |
|---------|----------|----------------|
| Parse mode | `"text/html"` (lowercases tags, mangles self-closing) | `"text/xml"` (proper XML) |
| Root element | Wrapped in `<html><body>` | `doc.documentElement` is the actual root |
| Self-closing tags | Treated as opening tags (HTML behavior) | Handled correctly (XML behavior) |
| Tag names | UPPERCASED | Case-preserved |
| `.children` | Available | Not available — use `.childNodes` + nodeType filter |

We tried three approaches:

### Approach 1: Vite Alias (Failed)

```typescript
// vite.config.ts
resolve: {
  alias: { "deno-dom": "@xmldom/xmldom" }
}
```

This compiles but fails at runtime. The APIs are different enough that a mechanical swap doesn't work. `parseFromString(xml, "text/html")` doesn't exist in xmldom. The HTML parser workarounds (self-closing tag expansion regex, querySelector for root) break with a real XML parser.

### Approach 2: Adapter Layer (Considered)

Write a `dom-adapter.ts` that abstracts over both implementations. This adds complexity for a single consumer and creates a leaky abstraction — the two parsers produce fundamentally different DOM trees.

### Approach 3: Adapted Copy (Chosen)

Copy the 680 lines of parser source into the npm package and adapt for xmldom:

```typescript
// Deno version (scorm-parser)
import { DOMParser, type Element } from "deno-dom";
const doc = parser.parseFromString(expandSelfClosing(xml), "text/html");
const root = doc.querySelector("manifest");

// Node version (transpiler)
import { DOMParser } from "@xmldom/xmldom";
const doc = parser.parseFromString(xml.replace(/^\uFEFF/, ""), "text/xml");
const root = doc.documentElement;
```

The adapted version is actually cleaner — proper XML parsing doesn't need the HTML workarounds. The trade-off is maintaining two copies of the parser. In practice, this code changes rarely (the SCORM spec is frozen), so the duplication cost is low.

## The Spectrum of Portability

After building 10 packages, a clear pattern emerged:

**Fully portable (zero changes):** Pure data transformation, type definitions, business logic with standard APIs. Our schema, lens, validator, and assessment scoring packages fall here.

**Portable with config (deno.json + package.json):** Code that uses npm packages via Deno's `npm:` specifier. Lit, marked, RxDB, Effect.ts — all work in both runtimes. The player package is 6,000+ lines of shared source with two config files.

**Not portable (adaptation needed):** Code using runtime-specific APIs. Our SCORM parser's DOM dependency required a separate adapted copy. Other examples: `Deno.readFile` vs `fs.readFile`, `deno-dom` vs `jsdom`/`xmldom`, JSR-only packages.

## Practical Guidelines

**1. Default to standard APIs.** Web Crypto over node:crypto. Fetch over node:http. TextEncoder over Buffer. These work everywhere.

**2. Isolate platform-specific code.** Our parser's DOM dependency is contained in 4 files out of 8. The other 4 (version detection, error types, sequencing extraction, metadata) are pure regex/string manipulation and shared without changes.

**3. Use `npm:` specifiers in deno.json.** This ensures your Deno code uses the same packages that npm consumers get:

```json
{
  "imports": {
    "lit": "npm:lit@^3.2.0",
    "effect": "npm:effect@^3.14.0"
  }
}
```

**4. Keep test dependencies separate.** `@std/assert` is Deno-only and belongs in test files, never source. The `.npmignore` excludes tests from the published package.

**5. Don't fight the runtime.** When a dependency is truly platform-specific, copy and adapt rather than building brittle abstraction layers. 680 lines of adapted parser code is cheaper than a DOM abstraction that leaks.

**6. Subpath exports need `preserveModules`.** Without it, Vite bundles everything into one file and `import { foo } from "@corm/player/cmi"` breaks.

## The Build Pipeline

Development and testing happen in Deno (fast, built-in TypeScript, great DX). Distribution happens through Vite + npm:

```
Write code → deno test → deno lint → deno fmt → vite build → npm publish
                Deno handles dev                  Vite handles dist
```

The Deno workspace (`deno.json` at root with `workspace` array) provides module resolution between packages during development. Vite's `resolve.alias` provides the same resolution during build:

```typescript
// vite.config.ts — resolve sibling Deno packages at build time
resolve: {
  alias: {
    "@corm/schema": resolve(__dirname, "../schema/src/mod.ts"),
  },
},
```

## What I'd Do Differently

**Start with the npm package.json on day one.** We added it after building the Deno packages, which meant retrofitting. Having both configs from the start keeps you honest about portability.

**Choose xmldom over deno-dom from the start.** xmldom works in both Deno and Node.js. We chose deno-dom for Deno-nativeness, then paid for it with an adapted copy. A portable dependency would have avoided the split.

**Pin Vite versions across projects.** Our player Storybook used Vite 6, but the consumer app used Vite 5. Caught it during integration planning, easy to fix, but would have been free to prevent.

## Bottom Line

Dual-targeting Deno and npm is practical for most TypeScript code. The pattern is: develop in Deno, build with Vite library mode, publish to npm. Pure logic and standard-API code needs only two config files. Platform-specific dependencies need adaptation — accept the copy cost rather than building fragile abstractions.

The honest ratio from our project: 8 out of 10 packages are fully portable. The 2 that needed work required adapting ~700 lines out of ~15,000 total. That's a 95% code-sharing rate — good enough.
