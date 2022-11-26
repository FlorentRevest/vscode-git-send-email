import React from "react";
import { Series } from "../../src/Series";
import { Commit } from "../../src/api/git";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

// Entry of a single commit in the git log
const PatchView = ({ patch, index }: { patch: Commit; index: number }) => {
  let title = patch.message.split("\n")[0];
  return (
    <li
      className="clickable"
      title={"by " + patch.authorName + " <" + patch.authorEmail + ">"}
      onClick={() => {
        vscode.postMessage({ command: "inspect", commitNb: index });
      }}>
      {title}
    </li>
  );
};

// List of commits
const PatchesView = ({ patches }: { patches: Commit[] }) => {
  return (
    <ul>
      {patches.map((email: Commit, i: number) => (
        <PatchView key={i} patch={email} index={i + 1} />
      ))}
    </ul>
  );
};

// Section that contains the list of patches in the series and buttons to add/remove some
export const PatchesSection = ({ series, log }: { series: Series; log: Commit[] }) => {
  return (
    <>
      <div id="flexbox">
        <label
          className="max-width"
          title="Number of consecutive commits leading to HEAD that will end up in the series">
          Patches:
        </label>

        {series.nbPatches > 1 && (
          <VSCodeButton
            onClick={(e: any) => {
              vscode.postMessage({ command: "removePatch" });
            }}
            appearance="icon"
            title="Remove patch">
            <span className="codicon codicon-remove" />
          </VSCodeButton>
        )}
        {series.nbPatches < 32 && (
          <VSCodeButton
            onClick={(e: any) => {
              vscode.postMessage({ command: "addPatch" });
            }}
            appearance="icon"
            title="Add patch">
            <span className="codicon codicon-add" />
          </VSCodeButton>
        )}
      </div>

      <PatchesView patches={log.slice(0, series.nbPatches)} />
    </>
  );
};
