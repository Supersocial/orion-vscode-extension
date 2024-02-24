import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getAbsoluteIconPath } from '../icons';
import {
    getInstalledPackageVersion,
    getPackageLockVersion,
    isMajorBump,
    isVersionNewer,
    isVersionOlder
} from '../utilities/npmUtils';

class AvailablePackagesProvider implements vscode.TreeDataProvider<RepoItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RepoItem | undefined | null> = new vscode.EventEmitter<RepoItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<RepoItem | undefined | null> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string, private octokit: any) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined); // Passing undefined refreshes all elements
    }

    async getRepoDependencies(): Promise<RepoItem[]> {
        try {
            // fetch a list of packages in this repository
            const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

            let items = [];
            
            for (const name in packageJson.dependencies) {
                // get the package name without the scope
                const org = name.split('/')[0];
                const packageName = name.split('/')[1];

                // fetch all versions for this package
                if (!name.startsWith('@supersocial/')) {
                    continue;
                }

                // get relevant versions
                const nodeModulesVersion = await getInstalledPackageVersion(packageName, org, this.workspaceRoot);
                const packageLockVersion = await getPackageLockVersion(packageName, org, this.workspaceRoot);

                // create the item
                items.push(new RepoItem(
                    packageName,
                    name,
                    nodeModulesVersion,
                    packageLockVersion
                ));
            }         
            
            return items;
        } catch (error) {
            console.error('Failed to load repo dependencies', error);
            vscode.window.showErrorMessage('Failed to load local packages. See console for details.');
            
            return [];
        }
    };

    async getTreeItem(element: RepoItem): Promise<vscode.TreeItem> {
        return element;
    };

    async getChildren(element: RepoItem): Promise<RepoItem[]> {
        let apiPath = '/repos/Supersocial/Orion/contents';
        
        if (element) {
            try {
                const versions = await this.octokit.packages.getAllPackageVersionsForPackageOwnedByOrg({
                    package_type: 'npm',
                    org: "Supersocial",
                    package_name: element.name,
                    per_page: 50
                });

                return versions.data
                    .sort((a: any, b: any) => b.name.localeCompare(a.name))
                    .map((version: { name: string; }) => {
                    return new VersionItem(
                        version.name,
                        element.name,
                        element.installedVersion,
                        {
                            command: 'orion.viewGitHubFileContent',
                            title: "View File",
                            arguments: [{
                                type: 'fileByName',
                                filePath: `${apiPath}/src/${element.name}/CHANGELOG.md`
                            }]
                        }
                    );
                });
            } catch (error) {
                console.error('Failed to load dependency versions', error);

                vscode.window.showErrorMessage('Failed to load dependency versions. See console for details.');
            };

            return [];
        } else {
            return this.getRepoDependencies();
        }
    }
}

class VersionItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly packageName: string,
        public readonly installedVersion: string | undefined,
        public readonly command?: vscode.Command
    ) {
        super(name, vscode.TreeItemCollapsibleState.None);
        this.installedVersion = installedVersion;
        this.contextValue = 'version';

        // display warning if new version is a major bump
        if (isMajorBump(this.installedVersion as string, this.name)) {
            this.tooltip = `Major version available: ${this.name}`;
            this.iconPath = getAbsoluteIconPath("workflowruns/wr_warning.svg");
        } else if (isVersionOlder(this.installedVersion as string, this.name)) {
            this.tooltip = `Update available: ${this.name}`;
            this.iconPath = new vscode.ThemeIcon("extensions-install-local-in-remote");
        } else if (isVersionNewer(this.installedVersion as string, this.name)) {
            this.tooltip = `Cannot downgrade: ${this.name} < ${this.installedVersion}`;
            this.iconPath = getAbsoluteIconPath("workflowruns/wr_failure.svg");
        } else if (this.installedVersion === this.name) {
            this.tooltip = 'Installed';
            this.iconPath = getAbsoluteIconPath("workflowruns/wr_success.svg");
        } else {
            this.tooltip = 'Equivalent version';
            this.iconPath = getAbsoluteIconPath("workflowruns/wr_skipped.svg");
        }
    }
}

class RepoItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly fullName: string,
        public readonly installedVersion: string | undefined,
        public readonly packageLockVersion: string | undefined
    ) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);

        this.fullName = fullName;
        this.installedVersion = installedVersion;
        this.packageLockVersion = packageLockVersion;

        this.description = `v${this.installedVersion}`;
        this.contextValue = "installed_dependency";

        if (this.installedVersion !== this.packageLockVersion) {
            this.tooltip = `Outdated: ${this.installedVersion} < ${this.packageLockVersion}`;
            this.iconPath = getAbsoluteIconPath("workflowruns/wr_warning.svg");
        } else {
            this.tooltip = `Up to date`;
            this.iconPath = getAbsoluteIconPath("workflowruns/wr_success.svg");
        }
    }
}

export default AvailablePackagesProvider;