// Parameters to remember for a given HEAD (the cover letter content is stored separately)

export interface SentEmail {
  title: string;
  messageId: string;
}

export interface SentSeries {
  prefix: string;
  timestamp: string;
  head: string;
  emails: SentEmail[];
}

export interface Series {
  prefix: string;
  version: number;
  title: string;
  tos: string[];
  ccs: string[];
  nbPatches: number;
  previouslySent: SentSeries[];
}
