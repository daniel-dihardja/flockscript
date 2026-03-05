import { DeviceCompiler } from "../types.ts";
import { compileOsc } from "./osc.ts";
import { compileOutput } from "./output.ts";

const DEVICE_REGISTRY = new Map<string, DeviceCompiler>([
  ["osc", compileOsc],
  ["output", compileOutput],
]);

/**
 * Returns the DeviceCompiler registered for `keyword`, or `undefined` when
 * the keyword is unknown.  Adding a new device type is as simple as importing
 * its compiler and adding a single entry here.
 */
export function getDeviceCompiler(keyword: string): DeviceCompiler | undefined {
  return DEVICE_REGISTRY.get(keyword);
}
