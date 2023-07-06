import React from "react";
import { VSCodeButton, VSCodeDivider } from "@vscode/webview-ui-toolkit/react";
import { SentEmail, Series } from "../../src/Series";

// List of already sent emails, bundled by series
export const PreviouslySentSection = ({ series }: { series: Series }) => {
  if (series.previouslySent.length) {
    return (
      <>
        <VSCodeDivider />

        <h4
          id="previouslySentHeader"
          className="max-width"
          title="List of emails associated with this branch that have already been sent out">
          Previously sent:
        </h4>

        {series.previouslySent.map((sentSeries, i) =>
          <>
            <div id="flexbox">
              <label
                className="max-width"
                title={"Sent on " + new Date(sentSeries.timestamp).toDateString() + " from " + sentSeries.head}>
                {sentSeries.prefix}:
              </label>

              <VSCodeButton
                onClick={() => {
                  vscode.postMessage({ command: "forgetSentSeries", number: i });
                }}
                appearance="icon"
                title={"Forget this series was sent"}>
                <span className="codicon codicon-discard" />
              </VSCodeButton>
            </div>

            <ul>
              {sentSeries.emails.map((email, j) => (
                <li
                  key={i}
                  className="clickable"
                  onClick={() => {
                    vscode.postMessage({ command: "openEmail", messageId: email.messageId });
                  }}>
                  {email.title}
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  } else {
    return <></>;
  }
};
