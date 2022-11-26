import * as vscode from "vscode";
import { getCoverLetter, saveCoverLetter } from "./utilities/database";

// Removes the leading / and protocol prefix from a URI
function headFromUri(uri: vscode.Uri): string {
  return uri.path.substring(1);
}

export class CoverLetterFs implements vscode.FileSystemProvider {
  constructor(private _context: vscode.ExtensionContext) {}

  // The extension subscribes to cover letter saves and uses it to update the webview
  protected _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  onDidChangeFile = this._onDidChangeFile.event;

  // Retrieve from persistent storage the cover letter for a given HEAD
  readFile(uri: vscode.Uri): Uint8Array {
    let coverLetter = getCoverLetter(headFromUri(uri), this._context);
    return new TextEncoder().encode(coverLetter);
  }

  // Store in persistent storage the cover letter for a given HEAD
  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    _options: { create: boolean; overwrite: boolean }
  ): void {
    let coverLetter = new TextDecoder().decode(content);
    saveCoverLetter(headFromUri(uri), coverLetter, this._context);

    this._onDidChangeFile.fire([
      {
        type: vscode.FileChangeType.Changed,
        uri: uri,
      },
    ]);
  }

  // Stub functions required to implement the file system API but useless here
  watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    return { dispose: () => {} };
  }
  stat(_uri: any): vscode.FileStat {
    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0,
    };
  }
  readDirectory(_uri: vscode.Uri): [string, vscode.FileType][] {
    return [];
  }
  createDirectory(_uri: vscode.Uri): void {}
  delete(_uri: vscode.Uri, _options: { recursive: boolean }): void {}
  rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { overwrite: boolean }): void {}
}
