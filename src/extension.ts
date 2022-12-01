import { ExtensionContext } from "vscode";
import {
  gitFormatPatch,
  checkpatchCommand,
  sendEmailCommand,
  getMaintainers,
} from "./utilities/commands";
import { sanitizeMaintainersEmail, getPossibleRecipients } from "./utilities/emails";
import { maintainersPath, getMaintainerPath, checkpatchPath } from "./utilities/config";
import { getSeries, saveSeries, getCoverLetter, saveCoverLetter } from "./utilities/database";
import { workspaceHasFile } from "./utilities/workspace";
import { getUri } from "./utilities/getUri";
import * as vscode from "vscode";
import { GitExtension, Repository } from "./api/git";
import { Series } from "./Series";
import { CoverLetterFs } from "./CoverLetterFs";

export class SeriesViewProvider implements vscode.WebviewViewProvider {
  private readonly _extensionUri: vscode.Uri;
  private _view?: vscode.WebviewView;
  private _head: string;
  private _series: Series;
  private _coverLetter: string;
  private _repo?: Repository;

  constructor(private _context: ExtensionContext) {
    this._extensionUri = _context.extensionUri;
    this._head = "";
    this._coverLetter = "";
    this._series = getSeries("", _context); // Dummy series
  }

  // Create a webview that loads the React app (under app/)
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    const scriptPath = getUri(webviewView.webview, this._extensionUri, ["out", "app", "bundle.js"]);
    const codiconsUri = getUri(webviewView.webview, this._extensionUri, [
      "node_modules",
      "@vscode/codicons",
      "dist",
      "codicon.css",
    ]);
    webviewView.webview.html = /*html*/ `
      <!DOCTYPE html>
       <html lang="en">
       <head>
         <meta charset="UTF-8">
           <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <title></title>
         <link href="${codiconsUri}" rel="stylesheet" />
       </head>
       <body>
         <div id="root"></div>
         <script>
           const vscode = acquireVsCodeApi();
         </script>
         <script src="${scriptPath}"></script>
       </body>
     </html>`;

    // Handle messages from the React app
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "send":
          this.send();
          break;
        case "inspect":
          this.inspect(message.commitNb);
          break;
        case "checkpatch":
          this.checkpatch();
          break;
        case "bump":
          this.bump();
          break;
        case "addEmail":
          this.addEmail(message.type, "");
          break;
        case "editEmail":
          this.editEmail(message.type, message.index, message.email);
          break;
        case "addPerson":
          this.addPerson(message.type);
          break;
        case "getMaintainers":
          this.getMaintainers(message.type);
          break;
        case "setPrefix":
          this.setPrefix(message.prefix);
          break;
        case "setVersion":
          this.setVersion(message.version);
          break;
        case "setTitle":
          this.setTitle(message.title);
          break;
        case "addPatch":
          this.addPatch();
          break;
        case "removePatch":
          this.removePatch();
          break;
        case "getContent":
          this.updateWebview();
          break;
        case "openCoverLetter":
          vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.parse("cover-letter:///" + this._head)
          );
          break;
      }
    });
  }

  // Every time this._series changes, save it to disk and refresh the webview
  private onSeriesChanged() {
    saveSeries(this._head, this._series, this._context);
    this.updateWebview();
  }

  // Everytime the cover letter fs notifies us of a modification, refresh the webview
  public onCoverLetterChanged() {
    this._coverLetter = getCoverLetter(this._head, this._context);
    this.updateWebview();
  }

  // Generate patches for the current series and return their paths
  private async gitFormatPatch(): Promise<string[]> {
    return await gitFormatPatch(this._series, this._coverLetter);
  }

  // Create a series and open each patch in a vscode tab
  private async inspect(commitNb: number | undefined) {
    let patches = await this.gitFormatPatch();

    patches.forEach((patch: string, index: number) => {
      if (!commitNb || commitNb === patches.length - index) {
        let uri = vscode.Uri.parse("file://" + patch);
        vscode.workspace.openTextDocument(uri).then((doc: any) => {
          vscode.window.showTextDocument(doc, { preview: false });
        });
      }
    });
  }

  // Create a series and run checkpatch against it in a terminal
  private async checkpatch() {
    let patches = await this.gitFormatPatch();

    let terminal = vscode.window.createTerminal("checkpatch");
    terminal.show();
    terminal.sendText(checkpatchCommand(patches), true);
  }

  // Create a series and generate a git send-email command in a terminal
  private async send() {
    let patches = await this.gitFormatPatch();

    let terminal = vscode.window.createTerminal("git send-email");
    terminal.show();
    terminal.sendText(sendEmailCommand(this._series, patches), false);
  }

  // Infer Tos or Ccs using a getMaintainer script
  private async getMaintainers(type: string) {
    let patches = await this.gitFormatPatch();

    let emails = await getMaintainers(type, patches);
    emails.forEach((email: string) => {
      this.addEmail(type, email);
    });
    this.onSeriesChanged();
  }

  // Copy the current git branch and bump the version number
  private async bump() {
    let currentSuffix = "-v" + this._series.version;
    let newSuffix = "-v" + (this._series.version + 1);

    let newHead = this._head.substring(0, this._head.length - currentSuffix.length) + newSuffix;
    if (!this._head.endsWith(currentSuffix)) {
      newHead = this._head + newSuffix;
    }

    this._repo
      ?.getBranch(newHead)
      .then(() => {
        vscode.window.showErrorMessage("The branch " + newHead + " already exists!");
        return;
      })
      .catch(() => {
        let newSeries = {
          ...this._series
        };
        newSeries.version++;
        saveCoverLetter(newHead, this._coverLetter, this._context);
        saveSeries(newHead, newSeries, this._context);

        this._repo?.createBranch(newHead, true);
      });
  }

  // Open a prompt to easily find an email in a MAINTAINERS file
  private addPerson(type: string) {
    vscode.window
      .showQuickPick(getPossibleRecipients(), {
        placeHolder: "Type a maintainer name. E.g: Linus",
      })
      .then((email: string | undefined) => {
        if (email) {
          this.addEmail(type, sanitizeMaintainersEmail(email));
        }
      });
  }

  // Add an email to the current series
  private addEmail(type: string, email: string) {
    let emailTrimmed = email.trim();
    if (type === "to") {
      if (!this._series.tos.includes(emailTrimmed)) {
        this._series.tos.push(emailTrimmed);
      }
    } else {
      if (!this._series.ccs.includes(emailTrimmed)) {
        this._series.ccs.push(emailTrimmed);
      }
    }
    this.onSeriesChanged();
  }

  // Edit an email in the current series
  private editEmail(type: string, index: number, email: string) {
    let emailTrimmed = email.trim();

    if (emailTrimmed.length) {
      if (type === "to") {
        this._series.tos[index] = emailTrimmed;
      } else {
        this._series.ccs[index] = emailTrimmed;
      }
    } else {
      if (type === "to") {
        this._series.tos.splice(index, 1);
      } else {
        this._series.ccs.splice(index, 1);
      }
    }

    this.onSeriesChanged();
  }

  // Change the subject prefix (eg. PATCH) of the current series
  private setPrefix(prefix: string) {
    this._series.prefix = prefix;
    this.onSeriesChanged();
  }

  // Change the version number (eg. v3) of the current series
  private setVersion(version: number) {
    this._series.version = version;
    this.onSeriesChanged();
  }

  // Change the cover letter title of the current series
  private setTitle(title: string) {
    this._series.title = title;
    this.onSeriesChanged();
  }

  // Increment the number of patches up to HEAD included in the current series
  private addPatch() {
    this._series.nbPatches = Math.min(32, this._series.nbPatches + 1);
    this.onSeriesChanged();
  }

  // Decrement the number of patches up to HEAD included in the current series
  private removePatch() {
    this._series.nbPatches = Math.max(1, this._series.nbPatches - 1);
    this.onSeriesChanged();
  }

  // Refresh the state variables of the React app
  public async updateWebview() {
    if (this._view && this._repo) {
      this._view.webview.postMessage({
        command: "setContent",
        series: this._series,
        head: this._head,
        log: await this._repo.log(),
        coverLetter: this._coverLetter,
        hasGetMaintainer: workspaceHasFile(getMaintainerPath()),
        hasCheckpatch: workspaceHasFile(checkpatchPath()),
        hasMaintainers: workspaceHasFile(maintainersPath()),
      });
    }
  }

  // Update HEAD and log when the repository state changed
  private onRepoStateChanged() {
    let headFound = false;

    if (this._repo) {
      let head = this._repo.state.HEAD;
      if (head) {
        let headName = head.name;
        if (headName) {
          headFound = true;
          this._head = headName;
        }
      }
    }

    if (!headFound) {
      this._head = "";
    }

    this._series = getSeries(this._head, this._context);
    this._coverLetter = getCoverLetter(this._head, this._context);
    this.updateWebview();
  }

  // Called when git.repositories[0] changes
  public async setRepo(repo?: Repository) {
    this._repo = repo;

    if (this._repo) {
      this._repo.state.onDidChange(() => {
        this.onRepoStateChanged();
      });
    }
    this.onRepoStateChanged();
  }
}

export async function activate(context: ExtensionContext) {
  // Left pane webview
  const seriesProvider = new SeriesViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("git-send-email.series", seriesProvider)
  );

  // Virtual file system providing cover letter editing capabilities
  const coverletterFs = new CoverLetterFs(context);
  coverletterFs.onDidChangeFile(() => {
    seriesProvider.onCoverLetterChanged();
  });
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider("cover-letter", coverletterFs, {
      isCaseSensitive: true,
    })
  );

  // Hooking to the git extension
  let gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (gitExtension) {
    gitExtension.activate().then(async (extension: any) => {
      let updateRepo = async () => {
        let repo = git.repositories[0];
        await seriesProvider.setRepo(repo);
      };

      let git = extension.getAPI(1);
      git.onDidOpenRepository(updateRepo);
      git.onDidCloseRepository(updateRepo);

      updateRepo();
    });
  } else {
    vscode.window.showErrorMessage("The git extension is required by git send-email");
  }
}
