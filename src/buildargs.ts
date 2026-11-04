import type { Detection } from "./detect";

/**
 * 由归属判定生成 `texmake` 子命令参数。
 * 项目模式为 `build`；成员模式为 `-p <name> build`，绝不编译整个工作区。
 * 不可构建的状态返回 undefined。纯函数，不依赖编辑器 API。
 */
export function buildArgs(d: Detection, extraArgs: readonly string[]): string[] | undefined {
  switch (d.kind) {
    case "project":
      return ["build", ...extraArgs];
    case "member":
      return ["-p", d.name, "build", ...extraArgs];
    case "unlocated":
    case "config-error":
    case "member-error":
      return undefined;
  }
}
