import { NotionBlock, NotionRichText } from "../notion/types.js";

const MAX_RICH_TEXT_LENGTH = 2000;

export function splitText(text: string, maxLen = MAX_RICH_TEXT_LENGTH): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Split at last newline before maxLen
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.5) {
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt < maxLen * 0.5) {
      splitAt = maxLen;
    }
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).replace(/^\n/, "");
  }
  return chunks;
}

export function parseInlineMarkdown(text: string): NotionRichText[] {
  const parts: NotionRichText[] = [];
  // Pattern: **bold**, *italic*, `code`, [text](url)
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      const plain = text.substring(lastIndex, match.index);
      if (plain) {
        parts.push(makeRichText(plain));
      }
    }

    if (match[1]) {
      // **bold**
      parts.push(makeRichText(match[2], { bold: true }));
    } else if (match[3]) {
      // *italic*
      parts.push(makeRichText(match[4], { italic: true }));
    } else if (match[5]) {
      // `code`
      parts.push(makeRichText(match[6], { code: true }));
    } else if (match[7]) {
      // [text](url)
      parts.push(makeRichText(match[8], {}, match[9]));
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    if (remaining) {
      parts.push(makeRichText(remaining));
    }
  }

  if (parts.length === 0) {
    parts.push(makeRichText(text));
  }

  return parts;
}

function makeRichText(
  content: string,
  annotations: Partial<NotionRichText["annotations"]> = {},
  linkUrl?: string
): NotionRichText {
  const rt: NotionRichText = {
    type: "text",
    text: { content },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default" as any,
      ...annotations,
    },
  };
  if (linkUrl) {
    rt.text.link = { url: linkUrl };
  }
  return rt;
}

function makeBlock(type: string, content: Record<string, unknown>): NotionBlock {
  return { object: "block", type, [type]: content } as NotionBlock;
}

function richTextBlock(richText: NotionRichText[]): Record<string, unknown> {
  return { rich_text: richText };
}

function headingToLevel(char: string): number {
  return char.length;
}

export function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Code blocks
    if (line.trim().startsWith("```")) {
      const lang = line.trim().replace("```", "").trim() || "plain text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        makeBlock("code", {
          rich_text: [makeRichText(codeLines.join("\n"))],
          language: lang,
        })
      );
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingToLevel(headingMatch[1]);
      const text = headingMatch[2];
      const key = `heading_${level}`;
      blocks.push(makeBlock(key, richTextBlock(parseInlineMarkdown(text))));
      i++;
      continue;
    }

    // Bulleted list
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (bulletMatch) {
      blocks.push(makeBlock("bulleted_list_item", richTextBlock(parseInlineMarkdown(bulletMatch[2]))));
      i++;
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (numberedMatch) {
      blocks.push(makeBlock("numbered_list_item", richTextBlock(parseInlineMarkdown(numberedMatch[2]))));
      i++;
      continue;
    }

    // Quote
    if (line.trim().startsWith("> ")) {
      const quoteText = line.trim().substring(2);
      blocks.push(makeBlock("quote", richTextBlock(parseInlineMarkdown(quoteText))));
      i++;
      continue;
    }

    // Divider
    if (line.trim().match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      blocks.push(makeBlock("divider", {}));
      i++;
      continue;
    }

    // Table detection (simple: | col | col |)
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i].trim();
        // Skip separator rows (|---|---|)
        if (!row.match(/^\|[\s\-:|]+\|$/)) {
          const cells = row.split("|").filter((c, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
          tableRows.push(cells);
        }
        i++;
      }
      if (tableRows.length > 0) {
        const width = Math.max(...tableRows.map(r => r.length));
        const tableWidth = Math.min(width, 5); // Notion max 5 columns
        blocks.push(
          makeBlock("table", {
            table_width: tableWidth,
            has_column_header: true,
            has_row_header: false,
            children: tableRows.map(row =>
              makeBlock("table_row", {
                cells: row.slice(0, tableWidth).map(cell => parseInlineMarkdown(cell)),
              })
            ),
          })
        );
      }
      continue;
    }

    // Regular paragraph
    // Accumulate consecutive non-special lines into one paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isSpecialLine(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      const text = paraLines.join(" ");
      const chunks = splitText(text);
      for (const chunk of chunks) {
        blocks.push(makeBlock("paragraph", richTextBlock(parseInlineMarkdown(chunk))));
      }
    } else {
      i++;
    }
  }

  return blocks;
}

function isSpecialLine(line: string): boolean {
  if (line.trim() === "") return true;
  if (line.trim().startsWith("```")) return true;
  if (line.match(/^#{1,3}\s+/)) return true;
  if (line.match(/^\s*[-*+]\s+/)) return true;
  if (line.match(/^\s*\d+\.\s+/)) return true;
  if (line.trim().startsWith("> ")) return true;
  if (line.trim().match(/^(-{3,}|\*{3,}|_{3,})$/)) return true;
  if (line.trim().startsWith("|") && line.trim().endsWith("|")) return true;
  return false;
}

export function markdownToRichText(text: string): NotionRichText[] {
  const parsed = parseInlineMarkdown(text);
  // Split oversized chunks
  const result: NotionRichText[] = [];
  for (const rt of parsed) {
    if (rt.text.content.length > MAX_RICH_TEXT_LENGTH) {
      const chunks = splitText(rt.text.content);
      for (const chunk of chunks) {
        result.push({ ...rt, text: { ...rt.text, content: chunk } });
      }
    } else {
      result.push(rt);
    }
  }
  return result;
}

export function markdownToNotionChildren(markdown: string): NotionBlock[] {
  const blocks = markdownToNotionBlocks(markdown);
  // Notion API max 100 blocks per request
  return blocks.slice(0, 100);
}
