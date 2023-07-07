import { VSCodeDivider, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { Series } from "../../src/Series";
import React, { useEffect, useState, useCallback } from "react";
import { Commit } from "../../src/api/git";
import { ActionsSection } from "./ActionsSection";
import { CoverLetterSection } from "./CoverLetterSection";
import { EmailsSection } from "./EmailsSection";
import { HeaderSection } from "./HeaderSection";
import { PreviouslySentSection } from "./PreviouslySentSection";
import { PatchesSection } from "./PatchesSection";
import { SubjectSection } from "./SubjectSection";

export const App = () => {
  const [head, setHead] = useState<string>("");
  const [coverLetter, setCoverLetter] = useState<string>("");
  const [series, setSeries] = useState<Series>();
  const [log, setLog] = useState<Commit[]>([]);
  const [hasGetMaintainer, setHasGetMaintainer] = useState<boolean>(false);
  const [hasCheckpatch, setHasCheckpatch] = useState<boolean>(false);
  const [hasMaintainers, setHasMaintainers] = useState<boolean>(false);
  const [hasPreviousVersion, setHasPreviousVersion] = useState<boolean>(false);

  // We can only be populated after the webview is alive
  const handleMessagesFromExtension = useCallback((event: MessageEvent) => {
    if (event.data.command === "setContent") {
      setSeries(event.data.series);
      setHead(event.data.head);
      setLog(event.data.log);
      setCoverLetter(event.data.coverLetter);
      setHasGetMaintainer(event.data.hasGetMaintainer);
      setHasCheckpatch(event.data.hasCheckpatch);
      setHasMaintainers(event.data.hasMaintainers);
      setHasPreviousVersion(event.data.hasPreviousVersion);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", (event: MessageEvent) => {
      handleMessagesFromExtension(event);
    });

    return () => {
      window.removeEventListener("message", handleMessagesFromExtension);
    };
  }, [handleMessagesFromExtension]);

  // Before we've received any info from the extension, we show a load spinner
  if (!series) {
    return <VSCodeProgressRing />;
  }

  // Once we've received content, we know if we have any git information
  if (head.length) {
    return (
      <>
        <HeaderSection head={head} series={series} />
        <VSCodeDivider />

        <SubjectSection series={series} />
        <VSCodeDivider />

        <CoverLetterSection series={series} coverLetter={coverLetter} />
        <VSCodeDivider />

        <PatchesSection series={series} log={log} />
        <VSCodeDivider />

        <EmailsSection
          series={series}
          hasGetMaintainer={hasGetMaintainer}
          hasMaintainers={hasMaintainers}
        />
        <VSCodeDivider />

        <ActionsSection hasCheckpatch={hasCheckpatch} hasPreviousVersion={hasPreviousVersion} />

        <PreviouslySentSection series={series} />
      </>
    );
  } else {
    return <h4>Does not function in detached-head mode</h4>;
  }
};
