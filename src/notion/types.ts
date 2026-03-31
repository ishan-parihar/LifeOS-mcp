export interface NotionProperty {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface NotionPage {
  id: string;
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
