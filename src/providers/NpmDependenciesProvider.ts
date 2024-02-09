import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios'; // Ensure axios is installed

class NpmDependenciesProvider implements vscode.TreeDataProvider<Dependency> {
    constructor(private workspaceRoot: string, private octokit: any) {}

    getTreeItem(element: Dependency): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: Dependency): Promise<Dependency[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return [];
        }

        if (element) {
            return [];
        } else {
            const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
            if (this.pathExists(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const deps = packageJson.dependencies
                    ? await Promise.all(
                          Object.keys(packageJson.dependencies).map(async (dep) => {
                              const currentVersion = packageJson.dependencies[dep];
                            //   const latestVersion = await this.fetchLatestVersion(dep);
                            //   const isOutdated = latestVersion !== null && currentVersion !== latestVersion;
                              return new Dependency(dep, currentVersion, "0.0.0", vscode.TreeItemCollapsibleState.None, true);
                          })
                      )
                    : [];
                return deps;
            } else {
                vscode.window.showInformationMessage('Workspace has no package.json');
                return [];
            }
        }
    }

    private pathExists(p: string): boolean {
        try {
            fs.accessSync(p);
        } catch (err) {
            return false;
        }
        return true;
    }

    private async fetchLatestVersion(packageName: string): Promise<string | null> {
        try {
            // Example: Fetch package versions for a repository
            // Adjust the request as necessary based on your GitHub Package Registry setup
            const response = await this.octokit.request('GET /repos/{owner}/{repo}/packages/{package_type}/{package_name}/versions', {
                owner: 'Supersocial',
                repo: 'Orion',
                package_type: 'npm',
                package_name: packageName,
            });
    
            // Logic to determine the latest version based on `response.data`
            // This part depends on how you define or interpret the latest version from the available data
            if (response.data.length > 0) {
                const latestVersion = response.data[0].version; // Simplified logic
                return latestVersion;
            }
            return null;
        } catch (error) {
            console.error(`Failed to fetch latest version for ${packageName}: ${error}`);
            return null;
        }
    }
}

class Dependency extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly version: string,
        public readonly latestVersion: string | null,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isOutdated: boolean
    ) {
        super(name, collapsibleState);
        this.description = `${version} ${isOutdated ? '(out-of-date)' : ''}`;
        this.tooltip = `${name}@${version} ${latestVersion ? `(Latest: ${latestVersion})` : ''}`;
        if (isOutdated) {
            this.iconPath = new vscode.ThemeIcon('warning');
        } else {
            this.iconPath = new vscode.ThemeIcon('notebook-state-success');
        }
    }
}

export default NpmDependenciesProvider