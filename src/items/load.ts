// Directory loader for item JSON: validated, duplicate-checked, id-sorted.

import { Glob } from "bun";
import { validateItem } from "./schema";
import type { Item } from "../types";

/** Reads every `*.json` in `dir`, validates each as an Item, returns them sorted by id. */
export async function loadItems(dir: string): Promise<Item[]> {
  const glob = new Glob("*.json");
  const paths: string[] = [];
  try {
    for await (const path of glob.scan({ cwd: dir, onlyFiles: true })) paths.push(path);
  } catch (cause) {
    throw new Error(`loadItems: cannot read ${dir}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  paths.sort();

  const items: Item[] = [];
  const seen = new Map<string, string>();
  for (const path of paths) {
    const file = `${dir}/${path}`;
    let raw: unknown;
    try {
      raw = JSON.parse(await Bun.file(file).text());
    } catch (cause) {
      throw new Error(`loadItems: ${file}: invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    let item: Item;
    try {
      item = validateItem(raw);
    } catch (cause) {
      throw new Error(`loadItems: ${file}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    const previous = seen.get(item.id);
    if (previous !== undefined) {
      throw new Error(`loadItems: duplicate item id ${JSON.stringify(item.id)} in ${previous} and ${file}`);
    }
    seen.set(item.id, file);
    items.push(item);
  }

  items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return items;
}
