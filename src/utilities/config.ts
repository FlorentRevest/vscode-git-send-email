import * as vscode from "vscode";

// Safe config wrappers that always return a string or string array
function getString(key: string): string {
  return vscode.workspace.getConfiguration().get("git-send-email." + key, "");
}
function getStringArray(key: string): string[] {
  return vscode.workspace.getConfiguration().get("git-send-email." + key, []);
}

// Convenience functions to extract configs
export function defaultSubjectPrefix(): string {
  return getString("defaultSubjectPrefix");
}
export function defaultTos(): string[] {
  return getStringArray("defaultTos");
}
export function defaultCcs(): string[] {
  return getStringArray("defaultCcs");
}
export function gitPath(): string {
  return getString("gitPath");
}
export function checkpatchPath(): string {
  return getString("checkpatchPath");
}
export function getMaintainerPath(): string {
  return getString("getMaintainerPath");
}
export function maintainersPath(): string {
  return getString("maintainersPath");
}
export function getMaintainerToArgs(): string[] {
  return getStringArray("getMaintainerToArgs");
}
export function getMaintainerCcArgs(): string[] {
  return getStringArray("getMaintainerCcArgs");
}
export function getFormatPatchArgs(): string[] {
  return getStringArray("formatPatchArgs");
}
