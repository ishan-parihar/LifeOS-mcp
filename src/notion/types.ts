export interface NotionProperty {
  id: string;
  type: string;
  name?: string;
  [key: string]: unknown;
}

export interface NotionPage {
  id: string;
  url?: string;
  properties: Record<string, NotionProperty>;
  created_time: string;
  last_edited_time: string;
}

export interface NotionQueryResponse {
  object: "list";
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface NotionDataSource {
  object: "data_source";
  id: string;
  title: Array<{ plain_text: string }>;
  properties: Record<string, NotionProperty>;
}

export interface NotionErrorResponse {
  object: "error";
  status: number;
  code: string;
  message: string;
}

export interface NotionRichText {
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  plain_text?: string;
}

export interface NotionBlock {
  object: "block";
  type: string;
  [key: string]: unknown;
}

export interface NotionCreatePageBody {
  parent: { data_source_id: string };
  properties: Record<string, unknown>;
  children?: NotionBlock[];
}
