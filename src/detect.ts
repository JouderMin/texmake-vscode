import path from "node:path";

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
