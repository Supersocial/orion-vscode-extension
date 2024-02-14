import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getAbsoluteIconPath } from '../icons';

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

    async getChildren(): Promise<RepoItem[]> {
        try {
            // fetch a list of packages in this repository
            const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

            let items = [];
            
            for (const name in packageJson.dependencies) {
                // get the installed version without the caret
                const installedVersion = packageJson.dependencies[name].replace('^', '');

                // get the package name without the scope
                const org = name.split('/')[0];
                const packageName = name.split('/')[1];

                // fetch all versions for this package
                if (!name.startsWith('@supersocial/')) {
                    continue;
                }

                items.push(this.octokit.packages.getAllPackageVersionsForPackageOwnedByOrg({
                    package_type: 'npm',
                    org: "Supersocial",
                    package_name: packageName,
                    per_page: 50
                }).then((versions: { data: string | any[]; }) => {
                    // fetch latest version
                    let latestVersion;

                    // find the first non canary version
                    for (let i = 0; i < versions.data.length; i++) {
                        const versionName = versions.data[i].name;

                        if (!versionName.includes('canary')) {
                            latestVersion = versionName;

                            break;
                        }
                    }

                    // determine if the installed version is the latest
                    return new RepoItem(
                        packageName,
                        name,
                        installedVersion,
                        latestVersion
                    );
                }).catch((error: any) => {
                    console.error(`Failed to load dependency version for ${org}/${packageName}`, error);

                    return [];
                }));
            }

            return Promise.all(items).catch((error) => {
                console.error('Failed to load repo dependencies', error);

                return [];
            });            
        } catch (error) {
            console.error('Failed to load repo dependencies', error);
            vscode.window.showErrorMessage('Failed to load local packages. See console for details.');
            return [];
        }
    }
}

class RepoItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly fullName: string,
        public readonly version: string,
        public readonly latestVersion: string
    ) {
        super(name, vscode.TreeItemCollapsibleState.None);
        this.version = version;
        this.latestVersion = latestVersion;
        this.fullName = fullName;

        this.description = `v${this.version}`;
        this.contextValue = (this.version === this.latestVersion) ? 'upToDate' : 'outdated';

        if (this.contextValue === 'outdated') {
            this.tooltip = `Outdated: ${this.version} < ${this.latestVersion}`;
            this.iconPath = getAbsoluteIconPath("workflowruns/wr_warning.svg");
        } else {
            this.tooltip = `Up to date`;
            this.iconPath = getAbsoluteIconPath("workflowruns/wr_success.svg");
        }
    }
}

export default AvailablePackagesProvider;