import React from "react";
import { Series } from "../../src/Series";
import { VSCodeTextArea, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";

// Cover letter title and content editing
export const CoverLetterSection = ({
  series,
  coverLetter,
}: {
  series: Series;
  coverLetter: string;
}) => {
  return (
    <>
      <VSCodeTextField
        value={series.title}
        onChange={(e: any) => {
          vscode.postMessage({ command: "setTitle", title: e.target.value });
        }}
        className="max-width">
        Cover letter title:
      </VSCodeTextField>

      <div
        id="cover-letter-wrapper"
        onClick={() => {
          vscode.postMessage({ command: "openCoverLetter" });
        }}>
        <VSCodeTextArea
          id="cover-letter"
          value={coverLetter}
          className="max-width"
          placeholder="Empty. No cover letter will be sent.">
          Cover letter content:
        </VSCodeTextArea>
      </div>
    </>
  );
};
