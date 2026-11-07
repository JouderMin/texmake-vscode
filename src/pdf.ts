import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";
import type { Detection } from "./detect";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** 取默认配方：`[project].default` 指定者，否则唯一配方。 */
function defaultRecipe(
  recipes: Record<string, unknown> | undefined,
  defaultName: string | undefined,
): Record<string, unknown> | undefined {
  if (recipes === undefined) {
    return undefined;
  }
  if (defaultName !== undefined) {
    const named = recipes[defaultName];
    return isRecord(named) ? named : undefined;
  }
  const names = Object.keys(recipes);
  if (names.length === 1) {
    const only = recipes[names[0]];
    return isRecord(only) ? only : undefined;
  }
  return undefined;
}

/**
 * 由归属判定推导 PDF 绝对路径。
 * 只读 `[project]` 的 `main`、`output`、`default` 与默认配方的 `main`、`output`；
 * 解析失败、缺 `main` 或不可构建状态一律返回 undefined，不抛异常。
 */
export function resolvePdfPath(d: Detection): string | undefined {
  let configPath: string;
  let projectRoot: string;
  switch (d.kind) {
    case "project":
      configPath = path.join(d.root, "texmake.toml");
      projectRoot = d.root;
      break;
    case "member":
      configPath = path.join(d.memberDir, "texmake.toml");
      projectRoot = d.memberDir;
      break;
    case "unlocated":
    case "config-error":
    case "member-error":
      return undefined;
  }

  let data: unknown;
  try {
    data = parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return undefined;
  }
  if (!isRecord(data) || !isRecord(data["project"])) {
    return undefined;
  }

  const project = data["project"];
  const recipes = isRecord(data["recipes"]) ? data["recipes"] : undefined;
  const recipe = defaultRecipe(recipes, nonEmptyString(project["default"]));

  const main = nonEmptyString(recipe?.["main"]) ?? nonEmptyString(project["main"]);
  if (main === undefined) {
    return undefined;
  }
  const output = nonEmptyString(recipe?.["output"]) ?? nonEmptyString(project["output"]) ?? "build";
  return path.resolve(projectRoot, output, path.parse(main).name + ".pdf");
}
