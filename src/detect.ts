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

type TomlRead =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; missing: boolean; reason: string };

/** 读取并解析一个 texmake.toml，不抛异常。 */
function readToml(configPath: string): TomlRead {
  let text: string;
  try {
    text = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, missing: code === "ENOENT", reason: firstLine(error) };
  }
  let data: unknown;
  try {
    data = parse(text);
  } catch (error) {
    return { ok: false, missing: false, reason: firstLine(error) };
  }
  if (!isRecord(data)) {
    return { ok: false, missing: false, reason: "texmake.toml 顶层必须是表" };
  }
  return { ok: true, data };
}

function projectName(data: Record<string, unknown>): string | undefined {
  const project = data["project"];
  const name = isRecord(project) ? project["name"] : undefined;
  return typeof name === "string" && name.trim() !== "" ? name : undefined;
}

/** 工作区分支：把文件映射到 members 中最深的成员目录，并按成员自己的配置取名。 */
function detectWorkspace(root: string, filePath: string, workspace: unknown): Detection {
  const members = isRecord(workspace) ? workspace["members"] : undefined;
  if (!Array.isArray(members) || members.some((member) => typeof member !== "string")) {
    return { kind: "config-error", root, reason: "[workspace] members 必须是字符串数组" };
  }

  const memberDirs = (members as string[]).map((member) => path.resolve(root, member));
  const memberDir = findContainingFolder(filePath, memberDirs);
  if (memberDir === undefined) {
    return { kind: "unlocated", reason: "当前文件不在 workspace.members 列出的成员目录内" };
  }

  const loaded = readToml(path.join(memberDir, "texmake.toml"));
  if (!loaded.ok) {
    const reason = loaded.missing
      ? `成员缺少 texmake.toml：${path.join(memberDir, "texmake.toml")}`
      : loaded.reason;
    return { kind: "member-error", root, memberDir, reason };
  }

  const name = projectName(loaded.data);
  if (name === undefined) {
    return { kind: "member-error", root, memberDir, reason: "成员配置缺少非空 [project] name" };
  }
  return { kind: "member", root, name, memberDir };
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

  const loaded = readToml(path.join(root, "texmake.toml"));
  if (!loaded.ok) {
    if (loaded.missing) {
      return { kind: "unlocated", reason: "未找到 texmake.toml" };
    }
    return { kind: "config-error", root, reason: loaded.reason };
  }
  const data = loaded.data;

  const project = data["project"];
  const workspace = data["workspace"];
  if (project !== undefined && workspace !== undefined) {
    return { kind: "config-error", root, reason: "配置同时包含 [project] 与 [workspace]，只能二选一" };
  }
  if (project === undefined && workspace === undefined) {
    return { kind: "config-error", root, reason: "配置缺少 [project] 或 [workspace] 表" };
  }
  if (workspace !== undefined) {
    return detectWorkspace(root, filePath, workspace);
  }

  const name = projectName(data);
  if (name === undefined) {
    return { kind: "config-error", root, reason: "[project] 缺少非空 name" };
  }
  return { kind: "project", root, name };
}
