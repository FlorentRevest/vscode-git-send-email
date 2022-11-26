import * as fs from "fs";
import * as vscode from "vscode";

// Convenience function to check for the presence of a file in the current workspace
export function workspaceHasFile(path: string) {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  return (
    workspaceFolders &&
    workspaceFolders.length &&
    fs.existsSync(workspaceFolders[0].uri.path + "/" + path)
  );
}
