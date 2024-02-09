import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { vsCodeBadge } from '@vscode/webview-ui-toolkit';

class GitHubRepoContentProvider implements vscode.TreeDataProvider<RepoItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RepoItem | undefined | null> = new vscode.EventEmitter<RepoItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<RepoItem | undefined | null> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string, private octokit: any) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined); // Passing undefined refreshes all elements
    }

    async getTreeItem(element: RepoItem): Promise<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: RepoItem): Promise<RepoItem[]> {
        let apiPath = '/repos/Supersocial/Orion/contents';
    
        if (element) {
            // Use the path from the element for subdirectory contents
            apiPath += `/${element.path}`;
        }
    
        try {
            const response = await this.octokit.packages.listPackagesForOrganization({
                package_type: 'npm',
                org: 'Supersocial',
                per_page: 100
            });

            // fetch a list of packages in this repository
            const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            console.log(packageJson);
    
            return Promise.all(response.data
                .sort((a: any, b: any) => a.name.localeCompare(b.name)) // Sort items alphabetically by name
                .map((item: any) => {
                    // Determine the path for the item. For root items, the path is directly available,
                    // for items within directories, prepend the parent directory's path
                    const itemPath = element ? `${element.path}/${item.name}` : item.path;
                    const properName = `@supersocial/${item.name}`;
                    const installed = packageJson.dependencies[properName] !== undefined;

                    return new RepoItem(
                        item.name,
                        item.type === 'dir' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                        itemPath, // Assuming itemPath holds the full GitHub path to the item
                        installed,
                        item.type !== 'dir' ? {
                            command: 'orion.viewGitHubFileContent', // This command will be triggered when a file item is clicked
                            title: "View File",
                            arguments: [item.download_url] // Pass the URL to fetch the file content as an argument
                        } : undefined
                    );
                }));            
        } catch (error) {
            console.error('Failed to load GitHub repository contents:', error);
            vscode.window.showErrorMessage('Failed to load GitHub repository contents. See console for details.');
            return [];
        }
    }
}

class RepoItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly path: string,
        public readonly installed: boolean,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.resourceUri = vscode.Uri.parse(path);
        this.contextValue = installed ? 'dependencyInstalled' : 'dependencyNotInstalled';

        if (installed) {
            this.iconPath = new vscode.ThemeIcon('notebook-state-success');
        } else {
            this.iconPath = new vscode.ThemeIcon('extensions-install-count');
        }
    }
}

export default GitHubRepoContentProvider;