import type { Detection } from "./detect";

/** 状态栏菜单项。id 由命令层映射到具体行为，纯数据不依赖编辑器 API。 */
export interface MenuItem {
  id: "build" | "clean" | "cancel" | "reason";
  label: string;
  description: string;
  /** codicon id（不含 `$()`），由编辑器侧包装成 ThemeIcon。 */
  icon: string;
}

/**
 * 由归属判定与构建状态生成状态栏菜单。
 * 构建中只允许取消；可构建态提供编译与清理；错误与未定位态只提供查看原因。
 */
export function menuItems(d: Detection, building: boolean): MenuItem[] {
  if (building) {
    return [
      { id: "cancel", label: "取消构建", description: "停止当前 texmake 进程", icon: "debug-stop" },
    ];
  }
  switch (d.kind) {
    case "project":
    case "member":
      return [
        { id: "build", label: "编译", description: `构建 ${d.name}`, icon: "play" },
        { id: "clean", label: "清理", description: `清理 ${d.name} 的辅助文件`, icon: "trash" },
      ];
    case "config-error":
    case "member-error":
    case "unlocated":
      return [{ id: "reason", label: "查看原因", description: d.reason, icon: "info" }];
  }
}
