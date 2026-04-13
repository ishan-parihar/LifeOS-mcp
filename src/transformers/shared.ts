import { NotionPage, NotionProperty } from "../notion/types.js";

export function extractTitle(page: NotionPage): string {
  for (const pv of Object.values(page.properties)) {
    if (pv.type === "title") {
      const titleProp = pv as unknown as { title: Array<{ plain_text: string }> };
      return titleProp.title.map((t) => t.plain_text).join("");
    }
  }
  return "Untitled";
}

export function extractString(page: NotionPage, propName: string): string {
  const prop = page.properties[propName];
  if (!prop) return "";

  switch (prop.type) {
    case "title":
      return (prop as unknown as { title: Array<{ plain_text: string }> }).title
        .map((t) => t.plain_text)
        .join("");
    case "rich_text":
      return (prop as unknown as { rich_text: Array<{ plain_text: string }> }).rich_text
        .map((t) => t.plain_text)
        .join("");
    case "select": {
      const sel = (prop as unknown as { select: { name: string } | null }).select;
      return sel?.name ?? "";
    }
    case "status": {
      const st = (prop as unknown as { status: { name: string } | null }).status;
      return st?.name ?? "";
    }
    case "formula": {
      const f = (prop as unknown as { formula: { type: string; [k: string]: unknown } }).formula;
      if (f.type === "string") return (f.string as string) ?? "";
      if (f.type === "number") return String(f.number ?? "");
      if (f.type === "boolean") return String(f.boolean);
      if (f.type === "date") {
        const d = f.date as { start: string } | null;
        return d?.start ?? "";
      }
      return "";
    }
    case "unique_id": {
      const uid = prop as unknown as { unique_id: { prefix: string; number: number } | null };
      if (uid.unique_id) return `${uid.unique_id.prefix}-${uid.unique_id.number}`;
      return "";
    }
    case "date": {
      const d = (prop as unknown as { date: { start: string; end: string | null } | null }).date;
      return d?.start ?? "";
    }
    case "relation":
      return `${((prop as unknown as { relation: Array<unknown> }).relation?.length ?? 0)} related`;
    case "checkbox":
      return String((prop as unknown as { checkbox: boolean }).checkbox);
    case "last_edited_time":
      return (prop as unknown as { last_edited_time: string }).last_edited_time ?? "";
    case "multi_select": {
      const multi = (prop as unknown as { multi_select: Array<{ name: string }> | null }).multi_select;
      return multi?.map((m) => m.name).join(", ") ?? "";
    }
    case "url": {
      return (prop as unknown as { url: string | null }).url ?? "";
    }
    case "email": {
      return (prop as unknown as { email: string | null }).email ?? "";
    }
    default:
      return "";
  }
}

export function extractNumber(page: NotionPage, propName: string): number | null {
  const prop = page.properties[propName];
  if (!prop) return null;
  if (prop.type === "formula") {
    const f = (prop as unknown as { formula: { type: string; number?: number } }).formula;
    return f.type === "number" ? (f.number ?? null) : null;
  }
  if (prop.type === "number") {
    return (prop as unknown as { number: number }).number ?? null;
  }
  return null;
}

export function extractDate(page: NotionPage, propName: string): string {
  const prop = page.properties[propName];
  if (!prop) return "";
  if (prop.type === "date") {
    const d = (prop as unknown as { date: { start: string } | null }).date;
    return d?.start ?? "";
  }
  if (prop.type === "formula") {
    const f = (prop as unknown as { formula: { type: string; date?: { start: string } } }).formula;
    return f.type === "date" ? (f.date?.start ?? "") : "";
  }
  return "";
}

export function extractBoolean(page: NotionPage, propName: string): boolean {
  const prop = page.properties[propName];
  if (!prop) return false;
  if (prop.type === "checkbox") return (prop as unknown as { checkbox: boolean }).checkbox;
  if (prop.type === "formula") {
    const f = (prop as unknown as { formula: { type: string; boolean?: boolean } }).formula;
    return f.type === "boolean" ? (f.boolean ?? false) : false;
  }
  return false;
}

export function extractRelationCount(page: NotionPage, propName: string): number {
  const prop = page.properties[propName];
  if (!prop || prop.type !== "relation") return 0;
  return (prop as unknown as { relation: Array<unknown> }).relation?.length ?? 0;
}

export function extractRelationIds(page: NotionPage, propName: string): string[] {
  const prop = page.properties[propName];
  if (!prop || prop.type !== "relation") return [];
  const rels = (prop as unknown as { relation: Array<{ id: string }> }).relation;
  return rels?.map((r) => r.id) ?? [];
}

export function extractMultiSelect(page: NotionPage, propName: string): string[] {
  const prop = page.properties[propName];
  if (!prop) return [];
  if (prop.type === "multi_select") {
    const items = (prop as unknown as { multi_select: Array<{ name: string }> }).multi_select;
    return items?.map((i) => i.name) ?? [];
  }
  return [];
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysAgo(iso: string): number {
  if (!iso) return 999;
  const d = new Date(iso);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}
