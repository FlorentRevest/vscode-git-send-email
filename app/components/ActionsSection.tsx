import React from "react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

// Inspect/Checkpatch/Send buttons towards the bottom
export const ActionsSection = ({
  hasCheckpatch,
  hasPreviousVersion,
}: {
  hasCheckpatch: boolean;
  hasPreviousVersion: boolean;
}) => {
  return (
    <>
      <div id="flexbox" className="action-flexbox">
        <VSCodeButton
          appearance="secondary"
          title="Run an interactive rebase on the commits of this series"
          onClick={() => {
            vscode.postMessage({ command: "rebase-i" });
          }}>
          Rebase&#8239;&#8209;i
          <span slot="start" className="codicon codicon-source-control" />
        </VSCodeButton>

        <div className="max-width"></div>

        {hasPreviousVersion && (
          <VSCodeButton
            appearance="secondary"
            title="Run git range-diff against the previous version of this series"
            onClick={() => {
              vscode.postMessage({ command: "rangeDiff" });
            }}>
            Range&#8209;diff
            <span slot="start" className="codicon codicon-git-compare" />
          </VSCodeButton>
        )}
      </div>

      <div id="flexbox" className="action-flexbox">
        <VSCodeButton
          appearance="secondary"
          title="Generate patches and open them in tabs"
          onClick={() => {
            vscode.postMessage({ command: "inspect" });
          }}>
          Inspect
          <span slot="start" className="codicon codicon-go-to-file" />
        </VSCodeButton>

        <div className="max-width"></div>

        {hasCheckpatch && (
          <VSCodeButton
            id="check-button"
            appearance="secondary"
            title="Generate patches and run checkpatch.pl"
            onClick={() => {
              vscode.postMessage({ command: "checkpatch" });
            }}>
            Checkpatch
            <span slot="start" className="codicon codicon-checklist" />
          </VSCodeButton>
        )}
      </div>

      <VSCodeButton
        id="send-button"
        appearance="primary"
        title="Generate patches and a command to send them. You get to press the Enter key."
        onClick={() => {
          vscode.postMessage({ command: "send" });
        }}>
        Generate send command
        <span slot="start" className="codicon codicon-terminal" />
      </VSCodeButton>
    </>
  );
};
