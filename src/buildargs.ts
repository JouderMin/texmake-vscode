import type { Detection } from "./detect";

/** texmake 的两个操作：编译与清理。 */
export type Operation = "build" | "clean";

/**
 * 由归属判定生成 `texmake` 子命令参数。
 * 项目模式为 `<operation>`；成员模式为 `-p <name> <operation>`，绝不编译整个工作区。
 * 不可构建的状态返回 undefined。纯函数，不依赖编辑器 API。
 */
export function buildArgs(
  d: Detection,
  operation: Operation,
  extraArgs: readonly string[],
): string[] | undefined {
  switch (d.kind) {
    case "project":
      return [operation, ...extraArgs];
    case "member":
      return ["-p", d.name, operation, ...extraArgs];
    case "unlocated":
    case "config-error":
    case "member-error":
      return undefined;
  }
}
