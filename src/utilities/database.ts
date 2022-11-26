import { Series } from "../Series";
import { ExtensionContext } from "vscode";
import { defaultCcs, defaultSubjectPrefix, defaultTos } from "./config";

// Associate HEAD to series in a workspace persistent storage
export function saveSeries(head: string, series: Series, context: ExtensionContext) {
  if (head.length) {
    context.workspaceState.update("git-send-email:series:" + head, series);
  }
}

// Returns the Series for HEAD
export function getSeries(head: string, context: ExtensionContext): Series {
  let series: Series | undefined = context.workspaceState.get("git-send-email:series:" + head);
  if (!series || !head.length) {
    series = {
      prefix: defaultSubjectPrefix(),
      version: 1,
      title: "",
      ccs: defaultCcs(),
      tos: defaultTos(),
      nbPatches: 1,
    };
  }
  return series;
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
