import * as child_process from "child_process";
import * as fs from "fs";
import { Series } from "../Series";
import * as vscode from "vscode";
import { getMaintainerPath } from "./config";
import { gitPath, checkpatchPath, getMaintainerToArgs, getMaintainerCcArgs } from "./config";

// Convenience function to run a command in the current workspace
export async function runCommand(
  cmd: string,
  args: string[]
): Promise<string> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || !workspaceFolders.length) {
    vscode.window.showErrorMessage("No root workspace");
    return "";
  }

  let child = child_process.spawn(cmd, args, { cwd: workspaceFolders[0].uri.path });
  let stdoutChunks: string[] = [];
  await new Promise( (resolve) => {
    child.stdout.on('data', function(chunk) {
      stdoutChunks.push(chunk.toString());
    });
    child.on('close', resolve);
  });

  return stdoutChunks.join("");
}

// Creates a temporary directory and fill it with patches. Returns paths to patches
export async function gitFormatPatch(series: Series, coverLetter: string): Promise<string[]> {
  let args: string[] = [];
  args.push("format-patch");
  args.push("HEAD" + "~".repeat(series.nbPatches));

  let outDir = "/tmp/vscode-git-format-patch-" + Math.random().toString(36).slice(-5) + "/";
  args.push("-o" + outDir);

  let prefix = series.prefix;
  if (series.version !== 1) {
    prefix += " v" + series.version;
  }
  args.push("--subject-prefix=" + prefix);

  if (coverLetter.length) {
    args.push("--cover-letter");
  }

  await runCommand(gitPath(), args);

  if (coverLetter.length) {
    const coverLetterPath = outDir + "0000-cover-letter.patch";
    var data = fs.readFileSync(coverLetterPath, "utf-8");
    data = data.replace("*** SUBJECT HERE ***", series.title);
    data = data.replace("*** BLURB HERE ***", coverLetter);
    fs.writeFileSync(coverLetterPath, data, "utf-8");
  }

  return Array.from(fs.readdirSync(outDir), (f) => outDir + f);
}

// Returns a command to check the given set of patches
export function checkpatchCommand(patches: string[]) {
  return checkpatchPath() + " " + patches.join(" ");
}

// Returns a command to send a given series and set of patches
export function sendEmailCommand(series: Series, patches: string[]) {
  let args: string[] = [];
  args.push("send-email");
  series.tos.forEach((email: string) => {
    if (email.length) {
      args.push("--to=" + email);
    }
  });
  series.ccs.forEach((email: string) => {
    if (email.length) {
      args.push("--cc=" + email);
    }
  });
  args = args.concat(patches);

  return gitPath() + " " + args.join(" ");
}

// Returns the set of destination emails for a given email type (to/cc) and set of patches
export async function getMaintainers(type: string, patches: string[]): Promise<string[]> {
  let args: string[] = [];
  args.push("--separator=,");
  args.push("--no-rolestats");
  args.push("--no-n");
  if (type === "to") {
    args = args.concat(getMaintainerToArgs());
  } else {
    args = args.concat(getMaintainerCcArgs());
  }
  args = args.concat(patches);

  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Running " + getMaintainerPath() + "...",
    },
    async (progress) => {
      let stdout = await runCommand(getMaintainerPath(), args);
      return stdout.split(",");
    }
  );
}
