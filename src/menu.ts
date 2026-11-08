import type { ProjectConfig } from "./config";
import type { Detection } from "./detect";

/** 状态栏菜单项。id 由命令层映射到具体行为，纯数据不依赖编辑器 API。 */
export interface MenuItem {
  id: "build" | "clean" | "cancel" | "reason";
  label: string;
  description: string;
  /** codicon id（不含 `$()`），由编辑器侧包装成 ThemeIcon。 */
  icon: string;
  /** 命名配方的编译项；不设时交给 texmake 自己的默认配方。 */
  recipe?: string;
}

/** 无可读配方配置时保留原有单项「编译」，交给 texmake 默认逻辑。 */
function plainBuild(name: string): MenuItem {
  return { id: "build", label: "编译", description: `构建 ${name}`, icon: "play" };
}

/** 某个命名配方的编译项；`recipe` 由命令层透传给 `texmake build <recipe>`。 */
function namedBuild(name: string, recipe: string): MenuItem {
  return {
    id: "build",
    label: `编译（${recipe}）`,
    description: `用配方 ${recipe} 构建 ${name}`,
    icon: "play",
    recipe,
  };
}

/**
 * 生成可构建状态的编译项。
 * 有默认配方时先给不设 recipe 的「编译」（走 texmake 默认），其余配方逐个命名；
 * 无默认配方时只有唯一配方才给裸「编译」，多配方全部命名，避免点到必败的默认构建。
 */
function buildItems(name: string, config: ProjectConfig | undefined): MenuItem[] {
  const recipes = config?.recipes ?? [];
  const defaultRecipe = config?.defaultRecipe;
  if (recipes.length === 0) {
    return [plainBuild(name)];
  }
  if (defaultRecipe !== undefined) {
    return [
      { id: "build", label: "编译", description: `默认配方：${defaultRecipe}`, icon: "play" },
      ...recipes
        .filter((recipe) => recipe !== defaultRecipe)
        .map((recipe) => namedBuild(name, recipe)),
    ];
  }
  if (recipes.length === 1) {
    // texmake 对单配方隐式使用该配方，无需额外参数。
    return [plainBuild(name)];
  }
  return recipes.map((recipe) => namedBuild(name, recipe));
}

/**
 * 由归属判定与构建状态生成状态栏菜单。
 * 构建中只允许取消；可构建态提供编译（含命名配方）与清理；错误与未定位态只提供查看原因。
 */
export function menuItems(d: Detection, building: boolean, config?: ProjectConfig): MenuItem[] {
  if (building) {
    return [
      { id: "cancel", label: "取消构建", description: "停止当前 texmake 进程", icon: "debug-stop" },
    ];
  }
  switch (d.kind) {
    case "project":
    case "member":
      return [
        ...buildItems(d.name, config),
        { id: "clean", label: "清理", description: `清理 ${d.name} 的辅助文件`, icon: "trash" },
      ];
    case "config-error":
    case "member-error":
    case "unlocated":
      return [{ id: "reason", label: "查看原因", description: d.reason, icon: "info" }];
  }
}
