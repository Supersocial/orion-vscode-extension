import * as vscode from 'vscode';

class GitHubRepoContentProvider implements vscode.TreeDataProvider<RepoItem> {

    constructor(private octokit: any) {}

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
                        command: 'orion.viewGitHubFileContent', // This command will be triggered when a file item is clicked
                        title: "View File",
                        arguments: [item.download_url] // Pass the URL to fetch the file content as an argument
                    } : undefined
                );
            });
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
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.resourceUri = vscode.Uri.parse(path);
    }
}

export default GitHubRepoContentProvider;