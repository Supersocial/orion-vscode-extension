import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

class AvailablePackagesProvider implements vscode.TreeDataProvider<RepoItem> {
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
    
        // validate that the user is in the org
        try {
            // get the current user
            const user = await this.octokit.users.getAuthenticated();
            
            // check the users permissions in the org
            await this.octokit.orgs.checkMembershipForUser({
                org: 'Supersocial',
                username: user.data.login
            });
        } catch (e) {
            vscode.window.showErrorMessage('You are not in the Supersocial org. Please join the org to use this extension.');
            
            return [];
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
    
            return Promise.all(response.data
                .sort((a: any, b: any) => a.name.localeCompare(b.name)) // Sort items alphabetically by name
                .map(async (item: any) => {
                    // Determine the path for the item. For root items, the path is directly available,
                    // for items within directories, prepend the parent directory's path
                    const itemPath = element ? `${element.path}/${item.name}` : item.path;
                    const properName = `@supersocial/${item.name}`;
                    const installed = packageJson.dependencies[properName] !== undefined;

                    if (installed) {
                        return null;
                    }

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
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.resourceUri = vscode.Uri.parse(path);
        this.iconPath = new vscode.ThemeIcon('package');
    }
}

export default AvailablePackagesProvider;