import path from "node:path";
import * as vscode from "vscode";
import { buildArgs } from "./buildargs";
import { detect, type Detection } from "./detect";
import { Runner } from "./runner";
import { statusLabel, statusTooltip } from "./status";

/** 状态栏优先级；数值越大越靠左。 */
const STATUS_BAR_PRIORITY = 100;

interface Settings {
  executable: string;
  extraArgs: readonly string[];
  f5Enabled: boolean;
}

function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration("texmake");
  return {
    executable: config.get<string>("executable", "texmake"),
    extraArgs: config.get<readonly string[]>("extraArgs", []),
    f5Enabled: config.get<boolean>("f5Enabled", true),
  };
}

/** 当前活动编辑器的归属判定；非 .tex 文件一律按未定位处理，不读磁盘。 */
function currentDetection(): Detection {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return { kind: "unlocated", reason: "没有打开的文件" };
  }
  const filePath = editor.document.uri.fsPath;
  if (path.extname(filePath).toLowerCase() !== ".tex") {
    return { kind: "unlocated", reason: "当前文件不是 .tex" };
  }
  const folders = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
  return detect(filePath, folders);
}

/** 命令提示与 showReason 用的说明文本。 */
function reasonOf(d: Detection): string {
  switch (d.kind) {
    case "unlocated":
    case "config-error":
    case "member-error":
      return d.reason;
    case "project":
      return `当前文件属于 texmake 工程 ${d.name}`;
    case "member":
      return `当前文件属于 texmake 成员 ${d.name}`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("texmake");
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    STATUS_BAR_PRIORITY,
  );
  const runner = new Runner();
  statusBar.show();

  // 构建代数用于区分新旧构建：旧构建收尾时不得复位新构建的状态。
  let buildGeneration = 0;
  let buildingLabel: string | undefined;

  /** 重新判定归属，刷新状态栏文案、点击命令与三个上下文键。 */
  async function update(): Promise<void> {
    const settings = readSettings();
    const d = currentDetection();
    const args = buildArgs(d, settings.extraArgs);
    const command = args === undefined ? "" : [settings.executable, ...args].join(" ");

    statusBar.text =
      buildingLabel === undefined ? statusLabel(d) : `$(sync~spin) texmake: ${buildingLabel}`;
    statusBar.tooltip = statusTooltip(d, command);
    if (runner.running) {
      statusBar.command = "texmake.cancel";
    } else if (d.kind === "config-error" || d.kind === "member-error") {
      statusBar.command = "texmake.showReason";
    } else {
      statusBar.command = "texmake.build";
    }

    await Promise.all([
      vscode.commands.executeCommand("setContext", "texmake.projectActive", d.kind !== "unlocated"),
      vscode.commands.executeCommand("setContext", "texmake.f5Enabled", settings.f5Enabled),
      vscode.commands.executeCommand("setContext", "texmake.building", runner.running),
    ]);
  }

  /** 按当前归属启动一次构建；不可构建时说明原因。 */
  async function build(): Promise<void> {
    const settings = readSettings();
    const d = currentDetection();
    const args = buildArgs(d, settings.extraArgs);
    if (args === undefined || (d.kind !== "project" && d.kind !== "member")) {
      void vscode.window.showErrorMessage(reasonOf(d));
      return;
    }

    const generation = ++buildGeneration;
    const command = [settings.executable, ...args].join(" ");
    const root = d.root;
    buildingLabel = d.name;
    statusBar.text = `$(sync~spin) texmake: ${d.name}`;
    statusBar.command = "texmake.cancel";
    await vscode.commands.executeCommand("setContext", "texmake.building", true);
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `texmake: 构建 ${d.name}`,
          cancellable: true,
        },
        async (_progress, token) => {
          const cancelRequested = token.onCancellationRequested(() => runner.cancel());
          try {
            output.appendLine(`$ ${command} (cwd: ${root})`);
            const outcome = await runner.run({
              executable: settings.executable,
              args,
              cwd: root,
              onData: (chunk) => output.append(chunk),
            });
            output.appendLine("");
            if (outcome.cancelled) {
              void vscode.window.setStatusBarMessage("texmake: 已取消", 3000);
            } else if (outcome.spawnError !== undefined) {
              void vscode.window.showErrorMessage(`texmake 启动失败：${outcome.spawnError}`);
            } else if (outcome.code !== 0) {
              void vscode.window.showErrorMessage(
                `texmake 构建失败，退出码 ${outcome.code ?? "未知"}`,
              );
            }
          } finally {
            cancelRequested.dispose();
            output.show(true);
          }
        },
      );
    } finally {
      if (generation === buildGeneration) {
        buildingLabel = undefined;
        await vscode.commands.executeCommand("setContext", "texmake.building", false);
      }
      await update();
    }
  }

  context.subscriptions.push(
    output,
    statusBar,
    vscode.commands.registerCommand("texmake.build", () => build()),
    vscode.commands.registerCommand("texmake.cancel", () => runner.cancel()),
    vscode.commands.registerCommand("texmake.showReason", () =>
      vscode.window.showWarningMessage(reasonOf(currentDetection())),
    ),
    vscode.window.onDidChangeActiveTextEditor(() => {
      void update();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("texmake")) {
        void update();
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (path.basename(document.uri.fsPath) === "texmake.toml") {
        void update();
      }
    }),
  );

  void update();
}

export function deactivate(): void {}
