import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export async function getInstalledPackageVersion(packageName: string, packageScope: string, workspaceRoot: string): Promise<string | undefined> {
    const nodeModulesPath = path.join(workspaceRoot, 'node_modules', packageScope, packageName, 'package.json');

    try {
        const packageJsonContent = await fs.promises.readFile(nodeModulesPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);

        return packageJson.version;
    } catch (error) {
        vscode.window.showErrorMessage(`Error getting installed package version: ${error}`);

        return undefined;
    }
};

export async function getPackageLockVersion(packageName: string, packageScope: string, workspaceRoot: string): Promise<string | undefined> {
    const packageLockPath = path.join(workspaceRoot, 'package-lock.json');
    
    try {
        const packageLockContent = await fs.promises.readFile(packageLockPath, 'utf8');
        const packageLockJson = JSON.parse(packageLockContent);

        // Construct the path for the package in the package-lock.json
        const packageLockVersionPath = `node_modules/${packageScope}/${packageName}`;
        const packageLockVersion = packageLockJson.packages?.[packageLockVersionPath]?.version;

        return packageLockVersion;
    } catch (error) {
        vscode.window.showErrorMessage(`Error getting package lock version: ${error}`);

        return undefined;
    }
}

export async function checkIfPackageIsLocallyOutdated(packageName: string, packageScope: string, workspaceRoot: string) {
    const packageLockVersion = await getPackageLockVersion(packageName, packageScope, workspaceRoot);
    const installedVersion = await getInstalledPackageVersion(packageName, packageScope, workspaceRoot);

    if (!packageLockVersion || !installedVersion) {
        vscode.window.showErrorMessage(`Could not determine versions for ${packageName}.`);

        return;
    }

    if (packageLockVersion !== installedVersion) {
        vscode.window.showInformationMessage(`Package ${packageName} is outdated. Installed version: ${installedVersion}, Expected version: ${packageLockVersion}.`);
    } else {
        vscode.window.showInformationMessage(`Package ${packageName} is up to date.`);
    }
}

export function isMajorBump(oldVersion: string, newVersion: string) {
    // Extract the major, minor, and patch numbers from the version strings, ignoring pre-release tags
    const oldVersionParts = oldVersion.split('.').map(part => part.split('-')[0]);
    const newVersionParts = newVersion.split('.').map(part => part.split('-')[0]);

    // Parse the major versions as integers
    const oldMajor = parseInt(oldVersionParts[0], 10);
    const newMajor = parseInt(newVersionParts[0], 10);

    // Check if the new version is a major bump over the old version
    return newMajor > oldMajor;
}

export function isVersionOlder(version1: string, version2: string) {
    const parts1 = version1.split('.').map(part => parseInt(part.split('-')[0], 10));
    const parts2 = version2.split('.').map(part => parseInt(part.split('-')[0], 10));

    // Compare major, minor, and patch numbers in order
    for (let i = 0; i < parts1.length; i++) {
        if (parts1[i] < parts2[i]) { return true; };
        if (parts1[i] > parts2[i]) { return false; };
    }

    // If all parts are equal, version1 is not older
    return false;
}

export function isVersionNewer(version1: string, version2: string) {
    return isVersionOlder(version2, version1);
}