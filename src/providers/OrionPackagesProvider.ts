import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

class AvailablePackagesProvider implements vscode.TreeDataProvider<PackageItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PackageItem | undefined | null> = new vscode.EventEmitter<PackageItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<PackageItem | undefined | null> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string, private octokit: any) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined); // Passing undefined refreshes all elements
    }

    async getTreeItem(element: PackageItem): Promise<vscode.TreeItem> {
        return element;
    }

    async getPackages() {
        const response = await this.octokit.packages.listPackagesForOrganization({
            package_type: 'npm',
            org: 'Supersocial',
            per_page: 100
        });

        return response.data;
    }

    async getChildren(): Promise<PackageItem[]> {
        let apiPath = '/repos/Supersocial/Orion/contents';

    
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
            const packages = await this.getPackages();

            // fetch a list of packages in this repository
            const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
            return Promise.all(packages
                .sort((a: any, b: any) => a.name.localeCompare(b.name))
                .map(async (item: any) => {
                    const properName = `@supersocial/${item.name}`;
                    const installed = packageJson.dependencies[properName] !== undefined;

                    if (installed) {
                        return null;
                    }
    
                    return new PackageItem(
                        item.name,
                        {
                            command: 'orion.viewGitHubFileContent',
                            title: "View File",
                            arguments: [{
                                type: 'fileByName',
                                filePath: `${apiPath}/src/${item.name}/README.md`,
                            }]
                        }
                    );
                }));            
        } catch (error) {
            console.error('Failed to load orion packages contents:', error);
            vscode.window.showErrorMessage('Failed to load GitHub repository contents. See console for details.');
            return [];
        }
    }
}

class PackageItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly command?: vscode.Command
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${this.label}`;
        this.iconPath = new vscode.ThemeIcon('package');
    }
}

export default AvailablePackagesProvider;