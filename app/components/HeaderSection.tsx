import React from "react";
import { Series } from "../../src/Series";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

// Current HEAD label and the "Bump branch" button
export const HeaderSection = ({ head, series }: { head: string; series: Series }) => {
  return (
    <header>
      <div id="flexbox">
        <h4 className="max-width" title="These series parameters are remembered for this HEAD">
          HEAD at {head}
        </h4>

        {series.version < 10 && (
          <VSCodeButton
            onClick={(e: any) => {
              vscode.postMessage({ command: "bump" });
            }}
            appearance="icon"
            title="Copy the current branch and bump its series version">
            <span className="codicon codicon-empty-window" />
          </VSCodeButton>
        )}
      </div>
    </header>
  );
};
