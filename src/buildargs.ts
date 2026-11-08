import type { Detection } from "./detect";

/** texmake 的两个操作：编译与清理。 */
export type Operation = "build" | "clean";

/**
 * 由归属判定生成 `texmake` 子命令参数。
 * 项目模式为 `<operation>`；成员模式为 `-p <name> <operation>`，绝不编译整个工作区。
 * build 时 `recipe` 紧跟在子命令之后；clean 忽略 `recipe`。
 * 不可构建的状态返回 undefined。纯函数，不依赖编辑器 API。
 */
export function buildArgs(
  d: Detection,
  operation: Operation,
  extraArgs: readonly string[],
  recipe?: string,
): string[] | undefined {
  const recipeArgs = operation === "build" && recipe !== undefined ? [recipe] : [];
  switch (d.kind) {
    case "project":
      return [operation, ...recipeArgs, ...extraArgs];
    case "member":
      return ["-p", d.name, operation, ...recipeArgs, ...extraArgs];
    case "unlocated":
    case "config-error":
    case "member-error":
      return undefined;
  }
}
