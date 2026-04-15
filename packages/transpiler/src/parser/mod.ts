// @corm/transpiler parser — re-exports matching @corm/scorm-parser API
export {
  ScormManifestNotFound,
  ScormParseError,
  ScormVersionUnsupported,
} from "./errors.ts";
export { detectVersion } from "./version-detect.ts";
export { parseSequencing } from "./sequencing-xml.ts";
export { parseOrganizationMetadata } from "./metadata-xml.ts";
export { parseManifestXml } from "./manifest-xml.ts";
export type {
  ScormItem,
  ScormManifest,
  ScormOrganization,
  ScormResource,
} from "./manifest-xml.ts";
