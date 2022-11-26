import React from "react";
import { Series } from "../../src/Series";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

// Inspect/Checkpatch/Send buttons towards the bottom
export const ActionsSection = ({
  hasCheckpatch,
}: {
  hasCheckpatch: boolean;
}) => {
  return (
    <>
      <div id="flexbox">
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
