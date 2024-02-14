import * as vscode from "vscode";

let _context: vscode.ExtensionContext;
export function initResources(context: vscode.ExtensionContext) {
  _context = context;
}

export function getAbsoluteIconPath(relativeIconPath: string): {
    light: string | vscode.Uri;
    dark: string | vscode.Uri;
  } {
    return {
      light: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "light", relativeIconPath),
      dark: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "dark", relativeIconPath)
    };
  }