import { ExtensionContext } from "vscode";
import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import {
  gitFormatPatch,
  checkpatchCommand,
  sendEmailCommand,
  getMaintainers,
} from "./utilities/commands";
import { sanitizeMaintainersEmail, getPossibleRecipients } from "./utilities/emails";
import { maintainersPath, getMaintainerPath, checkpatchPath, archiveUrlPrefixToMessageId, openEmailsWithPatchwork } from "./utilities/config";
import { getSeries, hasSeries, saveSeries, getCoverLetter, saveCoverLetter, getAllBranches } from "./utilities/database";
import { workspaceHasFile } from "./utilities/workspace";
import { getUri } from "./utilities/getUri";
import * as vscode from "vscode";
import { API, GitExtension, Repository } from "./api/git";
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
        case "changeHead":
          this.changeHead();
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
        case "openEmail":
          this.openEmail(message.messageId);
          break;
        case "forgetSentSeries":
          this.forgetSentSeries(message.number);
          break;
        case "rebase-i":
          this.interactiveRebase();
          break;
        case "rangeDiff":
          this.rangeDiff();
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

  // Let the user rework the current series
  private interactiveRebase() {
    let terminal = vscode.window.createTerminal("interactive rebase");
    terminal.show();
    const command = 'git rebase -i HEAD' + "~".repeat(this._series.nbPatches);
    setTimeout(() => terminal.sendText(command, true), 1000);
  }

  // Diff the current series with its previous version
  private async rangeDiff() {
    const prevHead = this.previousHead();

    if (!await this.hasPreviousVersion()) {
      vscode.window.showErrorMessage("No series remembered for " + prevHead);
      return;
    }

    const prevSeries = getSeries(prevHead, this._context);
    const previousRange = prevHead + "~".repeat(prevSeries.nbPatches) + ".." + prevHead;
    const currentRange = "HEAD" + "~".repeat(this._series.nbPatches) + "..HEAD";
    const command = "git range-diff " + previousRange + " " + currentRange;

    let terminal = vscode.window.createTerminal("range-diff");
    terminal.show();
    setTimeout(() => terminal.sendText(command, true), 1000);
  }

  // Create a series and run checkpatch against it in a terminal
  private async checkpatch() {
    let patches = await this.gitFormatPatch();

    let terminal = vscode.window.createTerminal("checkpatch");
    terminal.show();
    setTimeout(() => terminal.sendText(checkpatchCommand(patches), true), 1000);
  }

  // Create a series and generate a git send-email command in a terminal
  private async send() {
    let patches = await this.gitFormatPatch();

    // Create a named pipe so we can parse the terminal's logs live
    let pipe = "/tmp/vscode-git-send-email-" + Math.random().toString(36).slice(-5);
    child_process.spawnSync('mkfifo', [pipe]);

    // Continuously stream from that pipe
    let pipeFd = fs.openSync(pipe, fs.constants.O_RDWR);
    let stream = fs.createReadStream("", {fd: pipeFd, autoClose: false});
    let inserted = false;
    stream.on('data', (d: Buffer) => {
      // Find sent emails in the git send-email terminal output using a regexp
      var data = d.toString();
      var messageIdRegexp = new RegExp("^Subject:.+?\] (.+?)\r\n(?:.*?: .+?\r\n)+?Message-ID: <(.+?)>\r\n(?:.*?: .+?\r\n)+?\r\nResult: 250", "gm");
      var match = messageIdRegexp.exec(data);
      var foundSend = false;

      while (match !== null) {
        // Only insert a new sent series once
        if (!inserted) {
          inserted = true;
          this._series.previouslySent = [{
            timestamp: new Date().toISOString(),
            prefix: this._series.prefix + " v" + this._series.version,
            head: this._head,
            emails: [],
          }, ...this._series.previouslySent];
        }

        // Remember every email sent in that element
        this._series.previouslySent[0].emails.push({
          title: match[1],
          messageId: match[2],
        });

        foundSend = true;
        match = messageIdRegexp.exec(data);
      }

      // Update the series panel if we added sent emails
      if (foundSend) {
        this.onSeriesChanged();
      }
    });

    // Use "script" as a shell to mirror the terminal's stdout into the pipe
    let terminal = vscode.window.createTerminal({
      name: "git send-email",
      shellPath: "/usr/bin/script",
      shellArgs: [os.platform() === "linux" ? "-f" : "-F", "-q", pipe],
    });
    terminal.show();
    setTimeout(() => terminal.sendText(sendEmailCommand(this._series, patches), false), 1000);
  }

  private forgetSentSeries(i: number) {
    this._series.previouslySent.splice(i, 1);
    this.onSeriesChanged();
  }

  private openEmail(messageId: string) {
    const archiveUrl = vscode.Uri.parse(archiveUrlPrefixToMessageId() + messageId);

    if (openEmailsWithPatchwork()) {
      // If the Patchwork extension is installed, have it open the patch
      vscode.commands.executeCommand("patchwork.open", messageId, archiveUrl)
      // Otherwise, fallback to an archive link
        .then(()=>{}, () => vscode.commands.executeCommand("vscode.open", archiveUrl));
    } else {
      // And if disabled by config, also fallback to an archive link
      vscode.commands.executeCommand("vscode.open", archiveUrl);
    }
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

  private copyFromSeries(branch: string) {
    const series = getSeries(branch, this._context);
    const coverLetter = getCoverLetter(branch, this._context);
    let input = vscode.window.createQuickPick<vscode.QuickPickItem>();
    input.placeholder = "Choose what parameters should be copied";
    input.canSelectMany = true;
    input.items = [
      {
        label: "Prefix",
        description: series.prefix,
      },
      {
        label: "Version",
        description: series.version.toString(),
      },
      {
        label: "Cover letter title",
        description: series.title,
      },
      {
        label: "Cover letter content",
        description: coverLetter,
      },
      {
        label: "Number of patches",
        description: series.nbPatches.toString(),
      },
      {
        label: "Ccs",
        description: series.ccs.join(", "),
      },
      {
        label: "Tos",
        description: series.tos.join(", "),
      },
      {
        label: "Sent emails",
        description: series.previouslySent.length + " series",
      },
    ];
    input.onDidAccept(() => {
      input.hide();
      input.selectedItems.forEach((item: vscode.QuickPickItem) => {
        if (item.label === "Prefix") {
          this._series.prefix = series.prefix;
        } else if (item.label === "Version") {
          this._series.version = series.version;
        } else if (item.label === "Cover letter title") {
          this._series.title = series.title;
        } else if (item.label === "Cover letter content") {
          saveCoverLetter(this._head, coverLetter, this._context);
        } else if (item.label === "Number of patches") {
          this._series.nbPatches = series.nbPatches;
        } else if (item.label === "Ccs") {
          this._series.ccs = series.ccs;
        } else if (item.label === "Tos") {
          this._series.tos = series.tos;
        } else if (item.label === "Sent emails") {
          this._series.previouslySent = series.previouslySent;
        }
      });
      if (input.selectedItems.length) {
        this.onSeriesChanged();
      }
    });
    input.show();
  }

  // Returns QuickPickItems for each remembered series
  private existingSeriesItems(): Array<vscode.QuickPickItem> {
    let ret: Array<vscode.QuickPickItem> = [];
    getAllBranches(this._context).forEach((branch: string) => {
      const series = getSeries(branch, this._context);
      ret = ret.concat({
        label: branch,
        description: "[" + series.prefix + " v" + series.version + "] " +  series.title,
        picked: branch === this._head,
        buttons: [
          {
            iconPath: new vscode.ThemeIcon("trash"),
            tooltip: "Forget this series",
          },
          {
            iconPath: new vscode.ThemeIcon("copy"),
            tooltip: "Copy some parameters of this series",
          },
        ]
      });
    });
    return ret;
  }

  // Open a prompt to easily find another series to switch to
  private changeHead() {
    let input = vscode.window.createQuickPick<vscode.QuickPickItem>();
    input.placeholder = "Choose a series by branch name";
    input.matchOnDescription = true;
    input.matchOnDetail = true;
    input.items = this.existingSeriesItems();
    input.onDidTriggerItemButton(async (e: vscode.QuickPickItemButtonEvent<vscode.QuickPickItem>) => {
      if (e.button.tooltip?.startsWith("Forget")) {
        saveSeries(e.item.label, undefined, this._context);
        input.items = this.existingSeriesItems();
      } else {
        input.hide();
        this.copyFromSeries(e.item.label);
      }
    });
    input.onDidAccept(() => {
      input.hide();

      let items = input.activeItems;
      if (items.length) {
        this._repo?.checkout(items[0].label);
      }
    });
    input.show();
  }

  // Return whether a series is remembered for the branch of the previous version of this series
  private async hasPreviousVersion(): Promise<boolean> {
    const prevHead = this.previousHead();
    return hasSeries(prevHead, this._context) && (await this._repo?.getBranch(prevHead) !== undefined);
  }

  // Return the branch name for version v-1
  private previousHead() {
    let currentSuffix = "-v" + this._series.version;
    let newSuffix = "-v" + (this._series.version - 1);
    if (newSuffix === "-v1") {
      newSuffix = "";
    }

    let ret = this._head.substring(0, this._head.length - currentSuffix.length) + newSuffix;
    if (!this._head.endsWith(currentSuffix)) {
      ret = this._head + newSuffix;
    }

    return ret;
  }

  // Return the branch name for version v+1
  private nextHead() {
    let currentSuffix = "-v" + this._series.version;
    let newSuffix = "-v" + (this._series.version + 1);

    let ret = this._head.substring(0, this._head.length - currentSuffix.length) + newSuffix;
    if (!this._head.endsWith(currentSuffix)) {
      ret = this._head + newSuffix;
    }

    return ret;
  }

  // Copy the current git branch and bump the version number
  private async bump() {
    const newHead = this.nextHead();

    this._repo
      ?.getBranch(newHead)
      .then(() =>
        vscode.window.showErrorMessage("The branch " + newHead + " already exists!"))
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
        hasPreviousVersion: await this.hasPreviousVersion(),
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
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || !workspaceFolders.length) {
          await seriesProvider.setRepo(undefined);
          return;
        }

        if (workspaceFolders.length > 1) {
          vscode.window.showErrorMessage("You use a multi-folders workspace. Git send-email might pick the wrong folder and fail in unexpected ways.");
          return;
        }

        let repo = git.getRepository(workspaceFolders[0].uri);
        if (repo) {
          await seriesProvider.setRepo(repo);
        } else {
          await seriesProvider.setRepo(undefined);
        }
      };

      let git: API = extension.getAPI(1);
      git.onDidOpenRepository(updateRepo);
      git.onDidCloseRepository(updateRepo);

      updateRepo();
    });
  } else {
    vscode.window.showErrorMessage("The git extension is required by git send-email");
  }
}
