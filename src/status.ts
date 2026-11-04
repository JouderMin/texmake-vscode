import path from "node:path";
import type { Detection } from "./detect";

/**
 * 状态栏文案。纯函数，不依赖编辑器 API。
 * 未定位显示破折号；错误态显示警告图标；可构建态显示工程或成员名。
 */
export function statusLabel(d: Detection): string {
  switch (d.kind) {
    case "unlocated":
      return "texmake: —";
    case "config-error":
      return "$(warning) texmake: 配置错误";
    case "member-error":
      return "$(warning) texmake: 成员配置错误";
    case "project":
      return `texmake: ${d.name}`;
    case "member":
      return `texmake: ${d.name}`;
  }
}

/** 状态栏悬停提示，按行说明根目录、成员目录、命令与错误原因。 */
export function statusTooltip(d: Detection, command: string): string {
  switch (d.kind) {
    case "project":
      return [`根目录：${d.root}`, `命令：${command}`].join("\n");
    case "member":
      return [`根目录：${d.root}`, `成员目录：${d.memberDir}`, `命令：${command}`].join("\n");
    case "config-error":
      return [
        `配置错误：${d.reason}`,
        `配置文件：${path.join(d.root, "texmake.toml")}`,
      ].join("\n");
    case "member-error":
      return [
        `成员配置错误：${d.reason}`,
        `配置文件：${path.join(d.memberDir, "texmake.toml")}`,
      ].join("\n");
    case "unlocated":
      return [
        `未定位到 texmake 工程：${d.reason}`,
        "需要在工作区文件夹根目录放置 texmake.toml，并打开 .tex 文件。",
      ].join("\n");
  }
}
