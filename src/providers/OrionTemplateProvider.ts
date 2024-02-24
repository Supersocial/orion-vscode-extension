import * as vscode from 'vscode';

class GitHubRepoContentProvider implements vscode.TreeDataProvider<RepoItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RepoItem | undefined | null> = new vscode.EventEmitter<RepoItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<RepoItem | undefined | null> = this._onDidChangeTreeData.event;

    constructor(private octokit: any) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined); // Passing undefined refreshes all elements
    }

    async getTreeItem(element: RepoItem): Promise<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: RepoItem): Promise<RepoItem[]> {
        let apiPath = '/repos/Supersocial/Orion/contents/templates';

        if (element) {
            // If an element is provided, fetch its children by appending the element's path
            apiPath = `/repos/Supersocial/Orion/contents/${element.path}`;
        }
    
        try {
            const response = await this.octokit.request(apiPath, {
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
    
            return response.data.map((item: any) => {
                // Determine the path for the item. For root items, the path is directly available,
                // for items within directories, prepend the parent directory's path
                const itemPath = element ? `${element.path}/${item.name}` : item.path;
    
                return new RepoItem(
                    item.name,
                    item.type === 'dir' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    itemPath, // Assuming itemPath holds the full GitHub path to the item
                    item.type !== 'dir' ? {
                        command: 'orion.viewGitHubFileContent',
                        title: "View Template",
                        arguments: [{
                            downloadUrl: item.download_url,
                            type: 'githubFile'
                        }]
                    } : undefined
                );
            });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to load tempplate contents. See console for details.');
            
            return [];
        }
    }
}

class RepoItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly path: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = `View template`;
        this.resourceUri = vscode.Uri.parse(path);
    }
}

export default GitHubRepoContentProvider;