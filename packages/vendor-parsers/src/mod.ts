// @corm/vendor-parsers — public API

export { VendorParseError } from "./errors.ts";
export {
  HtmlToMarkdown,
  HtmlToMarkdownLive,
  type HtmlToMarkdownService,
} from "./html-to-md.ts";
export {
  detectVendor,
  genericParser,
  type VendorParser,
  VendorRegistry,
  VendorRegistryLive,
  type VendorRegistryService,
} from "./registry.ts";
export { articulateParser } from "./articulate.ts";
