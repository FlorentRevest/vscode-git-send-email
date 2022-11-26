import * as fs from "fs";
import * as readline from "readline";
import * as vscode from "vscode";
import { maintainersPath } from "./config";

// Parses the MAINTAINERS file to find a list of known emails
export async function getPossibleRecipients(): Promise<string[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || !workspaceFolders.length) {
    return [];
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(workspaceFolders[0].uri.path + "/" + maintainersPath()),
    crlfDelay: Infinity
  });

  let emails = new Set<string>();
  for await (const line of rl) {
    let matches = /^(?:M|R|L):\t(?<email>.*)$/.exec(line);
    if (matches && matches.groups && matches.groups.email.length !== 0) {
      emails.add(matches.groups.email);
    }
  }

  return Array.from(emails);
}

// Emails found in MAINTAINERS can be of the form First Lastname <email>, this extracts the email if necessary
export function sanitizeMaintainersEmail(email: string) {
  let matches = /<(?<email>.*)>/.exec(email);
  if (matches && matches.groups && matches.groups.email.length !== 0) {
    return matches.groups.email;
  }
  return email;
}
