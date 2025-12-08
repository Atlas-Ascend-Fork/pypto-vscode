export interface CodeSnippetDocument {
  isSuccessful: GetSnippetDocumentTag;
  document: string;
}

export enum GetSnippetDocumentTag {
  IS_SUCCESSFUL = 1,
  IS_NO_FILE = 2,
  IS_NO_LINE = 3,
}
