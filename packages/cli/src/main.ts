#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * CORM CLI — executable entry point.
 */
import { main } from "./cli.ts";

if (import.meta.main) {
  await main();
}
