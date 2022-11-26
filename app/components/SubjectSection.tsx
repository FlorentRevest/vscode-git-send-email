import React from "react";
import { Series } from "../../src/Series";
import {
  VSCodeTextField,
  VSCodeDropdown,
  VSCodeOption,
} from "@vscode/webview-ui-toolkit/react";

// Subject prefix (e.g: PATCH) and version (e.g: v2) editing section
export const SubjectSection = ({ series }: { series: Series }) => {
  return (
    <>
      <div id="flexbox">
        <VSCodeTextField
          className="max-width"
          placeholder="e.g: PATCH or RFC"
          value={series.prefix}
          onChange={(e: any) => {
            vscode.postMessage({ command: "setPrefix", prefix: e.target.value });
          }}>
          Subject prefix:
        </VSCodeTextField>

        <div id="version-wrapper">
          <label htmlFor="version-dropdown" className="clickable">Version:</label>
          <VSCodeDropdown
            id="version-dropdown"
            currentValue={"v" + series.version}
            onChange={(e: any) => {
              vscode.postMessage({ command: "setVersion", version: e.target.selectedIndex + 1 });
            }}>
            {Array.from({ length: 10 }, (_, i) => (
              <VSCodeOption key={i + 1}>v{i + 1}</VSCodeOption>
            ))}
          </VSCodeDropdown>
        </div>
      </div>
    </>
  );
};
