import React, { useState } from "react";
import { Series } from "../../src/Series";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

// "To:" or "Cc:" header with buttons to add more emails
const EmailsListHeader = ({
  type,
  hasGetMaintainer,
  hasMaintainers,
}: {
  type: string;
  hasGetMaintainer: boolean;
  hasMaintainers: boolean;
}) => {
  let capitalizedType = type[0].toUpperCase() + type.substring(1);
  return (
    <>
      <div id="flexbox">
        <label className="max-width" title={"List of " + capitalizedType + " recipients"}>
          {capitalizedType}:
        </label>

        {hasGetMaintainer && (
          <VSCodeButton
            onClick={() => {
              vscode.postMessage({ command: "getMaintainers", type: type });
            }}
            appearance="icon"
            title={"Use getMaintainers to infer relevant " + capitalizedType + "s"}>
            <span className="codicon codicon-wand" />
          </VSCodeButton>
        )}

        {hasMaintainers && (
          <VSCodeButton
            onClick={() => {
              vscode.postMessage({ command: "addPerson", type: type });
            }}
            appearance="icon"
            title={"Lookup an email from the MAINTAINERS names database"}>
            <span className="codicon codicon-person-add" />
          </VSCodeButton>
        )}

        <VSCodeButton
          onClick={() => {
            vscode.postMessage({ command: "addEmail", type: type });
          }}
          appearance="icon"
          title={"Add " + capitalizedType}>
          <span className="codicon codicon-add" />
        </VSCodeButton>
      </div>
    </>
  );
};

// Editable email entry
const EmailEntry = ({ email, type, index }: { email: string; type: string; index: number }) => {
  const [hovered, setHovered] = useState(false);
  const validEmail = !email.length || email.match(
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/
  );

  return (
    <li
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}>
      <span
        contentEditable={true}
        suppressContentEditableWarning={true}
        onBlur={(e: any) => {
          vscode.postMessage({ command: "editEmail", type: type, index: index, email: e.target.textContent });
        }}
        onKeyDown={(e: any) => {
          if (e.keyCode === 13) {
            e.preventDefault();
            e.target.blur();
          }
        }}>
        {email}
      </span>

      {hovered ? (
        <VSCodeButton
          onClick={(e: any) => {
            vscode.postMessage({ command: "editEmail", type: type, index: index, email: "" });
          }}
          className="remove-email float-right"
          appearance="icon"
          title="Remove patch">
          <span className="codicon codicon-remove" />
        </VSCodeButton>
      ) : (
        !validEmail && <span className="float-right codicon codicon-warning" />
      )}
    </li>
  );
};

// List of emails
const EmailsList = ({ emails, type }: { emails: string[]; type: string }) => {
  return (
    <ul>
      {emails.map((email: string, i: number) => (
        <EmailEntry key={i} email={email} type={type} index={i} />
      ))}
    </ul>
  );
};

// Section containing both Tos and Ccs editors
export const EmailsSection = ({
  series,
  hasGetMaintainer,
  hasMaintainers,
}: {
  series: Series;
  hasGetMaintainer: boolean;
  hasMaintainers: boolean;
}) => {
  return (
    <>
      <EmailsListHeader
        type="to"
        hasGetMaintainer={hasGetMaintainer}
        hasMaintainers={hasMaintainers}
      />
      <EmailsList emails={series.tos} type="to" />

      <EmailsListHeader
        type="cc"
        hasGetMaintainer={hasGetMaintainer}
        hasMaintainers={hasMaintainers}
      />
      <EmailsList emails={series.ccs} type="cc" />
    </>
  );
};
