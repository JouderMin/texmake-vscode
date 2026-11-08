import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";
import type { Detection } from "./detect";

/** 工程配置中与配方相关的部分。 */
export interface ProjectConfig {
  /** 顶层 `[recipes]` 表的键，按文件内出现顺序。 */
  recipes: string[];
  /**
   * 默认配方名。`[project].default` 优先；未指定且恰有一个配方时取该配方
   * （与 texmake 的默认行为一致）。`default` 指向不存在的配方时按未指定处理，
   * 返回 undefined，调用方据此交回 texmake 自己的默认逻辑。
   */
  defaultRecipe?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** 去掉 TOML 行内注释；引号内的 `#` 不算注释。 */
function stripComment(line: string): string {
  let quote: '"' | "'" | undefined;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote === '"') {
      if (ch === "\\") {
        i += 1;
      } else if (ch === '"') {
        quote = undefined;
      }
      continue;
    }
    if (quote === "'") {
      if (ch === "'") {
        quote = undefined;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#") {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * 把 TOML 键路径拆成片段（裸键、基本字符串键、字面量字符串键）。
 * 只用于确定顺序，无法识别时返回 undefined。
 */
function splitKeyPath(input: string): string[] | undefined {
  const parts: string[] = [];
  let i = 0;
  const skipSpace = (): void => {
    while (i < input.length && (input[i] === " " || input[i] === "\t")) {
      i += 1;
    }
  };

  skipSpace();
  while (i < input.length) {
    const quote = input[i];
    let key: string;
    if (quote === '"' || quote === "'") {
      const close = input.indexOf(quote, i + 1);
      if (close < 0) {
        return undefined;
      }
      key = input.slice(i + 1, close);
      i = close + 1;
      if (quote === '"') {
        try {
          key = JSON.parse(`"${key}"`) as string;
        } catch {
          // 非 JSON 兼容的转义按原文处理；键名不匹配时由调用方回退。
        }
      }
    } else {
      const start = i;
      while (i < input.length && input[i] !== "." && input[i] !== " " && input[i] !== "\t") {
        i += 1;
      }
      key = input.slice(start, i);
      if (!/^[A-Za-z0-9_-]+$/.test(key)) {
        return undefined;
      }
    }
    parts.push(key);
    skipSpace();
    if (i >= input.length) {
      break;
    }
    if (input[i] !== ".") {
      return undefined;
    }
    i += 1;
    skipSpace();
  }
  return parts.length > 0 ? parts : undefined;
}

/** 找赋值行第一个不在引号内的 `=`；没有时返回 -1。 */
function assignmentIndex(line: string): number {
  let quote: '"' | "'" | undefined;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote === '"') {
      if (ch === "\\") {
        i += 1;
      } else if (ch === '"') {
        quote = undefined;
      }
      continue;
    }
    if (quote === "'") {
      if (ch === "'") {
        quote = undefined;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "=") {
      return i;
    }
  }
  return -1;
}

/**
 * 按源码出现顺序列出 `[recipes]` 的键。
 * smol-toml 返回普通对象，整数样式的键会被 JS 重新排序，所以这里扫描表头与
 * 赋值行确定顺序；没扫描到的键按解析顺序补在末尾，保证不丢键。
 */
function orderedRecipeNames(text: string, table: Record<string, unknown>): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const add = (name: string): void => {
    if (!seen.has(name) && Object.prototype.hasOwnProperty.call(table, name)) {
      seen.add(name);
      order.push(name);
    }
  };

  let section: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (line === "") {
      continue;
    }

    const arrayHeader = /^\[\[(.*)\]\]$/.exec(line);
    if (arrayHeader !== null) {
      // 数组表（[[...]]）不进入配方表，只用于记录顺序。
      section = [];
      const path = splitKeyPath(arrayHeader[1]);
      if (path !== undefined && path[0] === "recipes" && path.length >= 2) {
        add(path[1]);
      }
      continue;
    }

    const header = /^\[(.*)\]$/.exec(line);
    if (header !== null) {
      const path = splitKeyPath(header[1]);
      section = path ?? [];
      if (path !== undefined && path[0] === "recipes" && path.length >= 2) {
        add(path[1]);
      }
      continue;
    }

    const eq = assignmentIndex(line);
    if (eq < 0) {
      continue;
    }
    const keyPath = splitKeyPath(line.slice(0, eq));
    if (keyPath === undefined) {
      continue;
    }
    if (section.length === 1 && section[0] === "recipes") {
      add(keyPath[0]);
    } else if (section.length === 0 && keyPath[0] === "recipes" && keyPath.length >= 2) {
      add(keyPath[1]);
    }
  }

  for (const name of Object.keys(table)) {
    add(name);
  }
  return order;
}

/**
 * 读取当前归属工程的配方配置。
 * project 读 `<root>/texmake.toml`，member 读 `<memberDir>/texmake.toml`，其余状态
 * 返回 undefined。读取、解析失败或 `[recipes]` 不是表时同样返回 undefined，不抛异常。
 */
export function projectConfig(d: Detection): ProjectConfig | undefined {
  let configPath: string;
  switch (d.kind) {
    case "project":
      configPath = path.join(d.root, "texmake.toml");
      break;
    case "member":
      configPath = path.join(d.memberDir, "texmake.toml");
      break;
    case "unlocated":
    case "config-error":
    case "member-error":
      return undefined;
  }

  let text: string;
  try {
    text = fs.readFileSync(configPath, "utf8");
  } catch {
    return undefined;
  }

  let data: unknown;
  try {
    data = parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(data)) {
    return undefined;
  }

  const recipesTable = data["recipes"];
  if (recipesTable !== undefined && !isRecord(recipesTable)) {
    return undefined;
  }
  const recipes = recipesTable === undefined ? [] : orderedRecipeNames(text, recipesTable);

  const project = isRecord(data["project"]) ? data["project"] : undefined;
  const declared = nonEmptyString(project?.["default"]);
  let defaultRecipe: string | undefined;
  if (declared !== undefined) {
    defaultRecipe = recipes.includes(declared) ? declared : undefined;
  } else if (recipes.length === 1) {
    defaultRecipe = recipes[0];
  }
  return { recipes, defaultRecipe };
}
