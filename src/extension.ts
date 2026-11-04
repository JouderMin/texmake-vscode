import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("texmake.build", () => {
      void vscode.window.showInformationMessage("texmake: 尚未实现");
    }),
  );
}

export function deactivate(): void {}
