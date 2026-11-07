# texmake VSCode 扩展

在 VSCode 里用 texmake 编译 LaTeX。扩展识别当前 `.tex` 文件属于哪个工程或工作区成员，在状态栏显示归属，并用 F5 调用 texmake 编译。

## 功能

- **识别归属**：找到包含当前文件的工作区文件夹，读取根目录的 `texmake.toml`。`[project]` 表表示单项目；`[workspace]` 的 `members` 列表把文件映射到成员目录，成员名取自成员自己的 `texmake.toml`。
- **状态栏**：空闲时显示工程名或成员名；配置错误显示警告图标；构建中显示 `$(sync~spin) texmake: <name>`。
- **状态栏菜单**：点击状态栏弹出菜单，提供编译、清理；构建中只提供取消构建，错误态提供查看原因。
- **F5 编译**：`texmake.projectActive && texmake.f5Enabled` 时接管 F5。单项目执行 `texmake build`，成员执行 `texmake -p <name> build`，工作目录为根目录。
- **清理**：菜单选「清理」或运行 `texmake.clean`。单项目执行 `texmake clean`，成员执行 `texmake -p <name> clean`，构建进行中时不并发执行。
- **取消与重启**：构建中再按 F5 会取消当前构建并重启。取消先发 SIGTERM，2 秒后仍未退出则发 SIGKILL。
- **输出**：每次编译或清理先向「texmake」输出通道写 `$ <完整命令> (cwd: <根目录>)`，随后流式输出 stdout 与 stderr；退出码非 0 时弹错误通知。
- **预览 PDF**：`.tex` 文件编辑器右上角显示预览按钮，点击后在右侧分栏用 VSCode 默认 PDF 编辑器打开该文档的 PDF；尚未生成时提供「编译并打开」。

## 命令

| 命令 | 说明 |
|---|---|
| `texmake.menu` | 打开状态栏菜单 |
| `texmake.build` | 编译当前文件所属的工程或成员 |
| `texmake.clean` | 清理当前文件所属的工程或成员的辅助文件 |
| `texmake.cancel` | 取消当前构建 |
| `texmake.showReason` | 显示归属判定原因 |
| `texmake.openPdf` | 在右侧分栏预览当前文档的 PDF |

## 安装

需要 VSCode 1.120 或更高版本，且 `texmake` 在 PATH 中（或用 `texmake.executable` 指定路径）。

```bash
pnpm install
pnpm run package
code --install-extension texmake-0.1.0.vsix
```

安装后重载窗口。

## 设置

| 键 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `texmake.executable` | string | `texmake` | texmake 可执行文件路径，或 PATH 中的名字 |
| `texmake.extraArgs` | string[] | `[]` | 追加到 `build` 之后的参数，例如 `["-v"]` |
| `texmake.f5Enabled` | boolean | `true` | 是否为 texmake 工程接管 F5 |

## 手工验收

以下步骤需要 VSCode 图形界面。自动化环境只验证打包与安装；F5 行为由用户或维护者按本节验收。

1. **单项目**：用 VSCode 打开 `texmake_test` 工作区，打开 `main.tex`。状态栏显示 `texmake: biber-check`。按 F5，texmake 输出通道首行为 `$ texmake build (cwd: .../texmake_test)`，构建成功时 `build/main.pdf` 的修改时间更新。
2. **两成员工作区**：建临时目录 `root`，写入根 `texmake.toml`（`[workspace]` 的 `members = ["paper", "slides"]`），并给 `paper` 与 `slides` 各写一份带 `[project] name` 的 `texmake.toml` 与 `main.tex`。用 VSCode 打开 `root`，在 `paper/main.tex` 按 F5。状态栏显示 `texmake: paper`，输出首行为 `$ texmake -p paper build (cwd: <root>)`。
3. **非 `.tex` 文件**：按 F5，扩展不接管，按键交回 VSCode。
4. **构建中再按 F5**：当前构建取消并重启，状态栏保持旋转图标，旧进程不残留。
5. **取消**：点击状态栏弹出菜单选「取消构建」，或点进度通知的取消按钮，构建在 2 秒内结束，状态栏提示「已取消」。
6. **清理**：打开 `main.tex`，点击状态栏选「清理」，输出首行为 `$ texmake clean (cwd: .../texmake_test)`，完成后状态栏提示「已清理 biber-check」3 秒。

## 限制

- 不向父目录查找 `texmake.toml`：根目录固定为包含当前文件的工作区文件夹。
- 不编译整个工作区：成员只用 `-p <name>` 构建。
- 路径判断是词法比较，不解析符号链接，区分大小写。
- 其他 LaTeX 扩展也可能绑定 F5，冲突由用户自行处理；可关闭 `texmake.f5Enabled` 交回按键。

## 开发

```bash
pnpm run typecheck   # 类型检查
pnpm run build       # 打包到 dist/extension.js
pnpm test            # 单元测试（node:test）
pnpm run package     # 生成 texmake-0.1.0.vsix
```

## 许可证

本项目使用 GNU 通用公共许可证第 3 版或更新版本发布，SPDX 标识为 `GPL-3.0-or-later`。全文见仓库根目录的 `LICENSE` 文件。
