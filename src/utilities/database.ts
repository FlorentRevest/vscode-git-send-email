import { Series } from "../Series";
import { ExtensionContext } from "vscode";
import { defaultCcs, defaultSubjectPrefix, defaultTos } from "./config";

// Associate HEAD to series in a workspace persistent storage
export function saveSeries(head: string, series: Series | undefined, context: ExtensionContext) {
  if (head.length) {
    context.workspaceState.update("git-send-email:series:" + head, series);
  }
}

// Returns the Series for HEAD
export function getSeries(head: string, context: ExtensionContext): Series {
  let series: any | undefined = context.workspaceState.get("git-send-email:series:" + head);
  if (!series || !head.length) {
    series = {
      prefix: defaultSubjectPrefix(),
      version: 1,
      title: "",
      ccs: defaultCcs(),
      tos: defaultTos(),
      nbPatches: 1,
      previouslySent: [],
    };
  }
  if (!("previouslySent" in series)) {
    series.previouslySent = [];
  }
  return series;
}

// Returns whether a Series exists for head
export function hasSeries(head: string, context: ExtensionContext): boolean {
  return context.workspaceState.keys().indexOf("git-send-email:series:" + head) !== -1;
}

// Returns all branches tracked in the database
export function getAllBranches(context: ExtensionContext): Array<string> {
  let branches: Array<string> = [];
  context.workspaceState.keys().forEach((key: string) => {
    if (key.startsWith("git-send-email:series:")) {
      branches.push(key.substring(22));
    }
  });
  return branches;
}

// Associate HEAD to coverLetter in a workspace persistent storage
export function saveCoverLetter(head: string, coverLetter: string, context: ExtensionContext) {
  if (head.length) {
    context.workspaceState.update("git-send-email:cover-letter:" + head, coverLetter);
  }
}

// Returns the cover letter for HEAD
export function getCoverLetter(head: string, context: ExtensionContext): string {
  if (!head.length) {
    return "";
  }
  return context.workspaceState.get("git-send-email:cover-letter:" + head, "");
}
