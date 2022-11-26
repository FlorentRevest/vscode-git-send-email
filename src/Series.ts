// Parameters to remember for a given HEAD (the cover letter content is stored separately)
export interface Series {
  prefix: string;
  version: number;
  title: string;
  tos: string[];
  ccs: string[];
  nbPatches: number;
}
