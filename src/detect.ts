import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";

/**
 * 规范化路径：解析为绝对路径，并去掉尾随分隔符。
 * 根目录（如 `/`）保留分隔符，否则拼接判断会失效。
 * 只做词法处理，不调用 realpath，也不解析符号链接。
 */
function normalizePath(input: string): string {
  const resolved = path.resolve(input);
  const root = path.parse(resolved).root;
  let result = resolved;
  while (result.length > root.length && result.endsWith(path.sep)) {
    result = result.slice(0, -1);
  }
  return result;
}

/** 判断 `child` 是否等于 `parent` 或位于 `parent` 之内。大小写敏感，不跟随符号链接。 */
export function isInside(child: string, parent: string): boolean {
  const childPath = normalizePath(child);
  const parentPath = normalizePath(parent);
  if (childPath === parentPath) {
    return true;
  }
  const prefix = parentPath.endsWith(path.sep) ? parentPath : parentPath + path.sep;
  return childPath.startsWith(prefix);
}

/** 从候选文件夹中找出包含 `filePath` 的最深一个；没有匹配时返回 undefined。 */
export function findContainingFolder(
  filePath: string,
  folders: readonly string[],
): string | undefined {
  let best: string | undefined;
  let bestLength = -1;
  for (const folder of folders) {
    if (!isInside(filePath, folder)) {
      continue;
    }
    const length = normalizePath(folder).length;
    if (length > bestLength) {
      best = folder;
      bestLength = length;
    }
  }
  return best;
}

/** 当前文件的归属判定结果。 */
export type Detection =
  | { kind: "unlocated"; reason: string }
  | { kind: "config-error"; root: string; reason: string }
  | { kind: "member-error"; root: string; memberDir: string; reason: string }
  | { kind: "project"; root: string; name: string }
  | { kind: "member"; root: string; name: string; memberDir: string };

/** 取错误消息首行，避免把整段堆栈塞进状态栏。 */
function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0].trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 判定 `filePath` 属于哪个 texmake 工程。
 * 根 = 包含该文件的工作区文件夹，不向父目录查找 texmake.toml。
 */
export function detect(filePath: string, workspaceFolders: readonly string[]): Detection {
  const root = findContainingFolder(filePath, workspaceFolders);
  if (root === undefined) {
    return { kind: "unlocated", reason: "当前文件不在工作区文件夹内" };
  }

  const configPath = path.join(root, "texmake.toml");
  let text: string;
  try {
    text = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { kind: "unlocated", reason: "未找到 texmake.toml" };
    }
    return { kind: "config-error", root, reason: firstLine(error) };
  }

  let data: unknown;
  try {
    data = parse(text);
  } catch (error) {
    return { kind: "config-error", root, reason: firstLine(error) };
  }
  if (!isRecord(data)) {
    return { kind: "config-error", root, reason: "texmake.toml 顶层必须是表" };
  }

  const project = data["project"];
  const workspace = data["workspace"];
  if (project !== undefined && workspace !== undefined) {
    return { kind: "config-error", root, reason: "配置同时包含 [project] 与 [workspace]，只能二选一" };
  }
  if (project === undefined && workspace === undefined) {
    return { kind: "config-error", root, reason: "配置缺少 [project] 或 [workspace] 表" };
  }
  if (workspace !== undefined) {
    // Task 4 替换为工作区成员定位。
    return { kind: "unlocated", reason: "工作区尚未支持" };
  }

  const name = isRecord(project) ? project["name"] : undefined;
  if (typeof name !== "string" || name.trim() === "") {
    return { kind: "config-error", root, reason: "[project] 缺少非空 name" };
  }
  return { kind: "project", root, name };
}
