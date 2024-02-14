// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Credentials } from './credentials';
import GitHubContentProvider from "./providers/GitHubContentProvider";
import GitHubRepoContentProvider from './providers/GitHubRepoContentProvider';
import OrionPackagesProvider from './providers/OrionPackagesProvider';
import NodeDependenciesProvider from './providers/NodeDependenciesProvider';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initResources } from './icons';
const secretKeys = ['githubAccessToken'];

/*
	Runs a command in the terminal and returns the output
*/
async function runCommand(command: string, cwd: string) {
	return new Promise((resolve, reject) => {
		childProcess.exec(command, { cwd }, (error, stdout, stderr) => {
			if (error) {
				reject(error);
			} else {
				resolve(stdout);
			}
		});
	});
}

/*
	Wraps run command since we need to determine the workspace folder path
*/
async function runNpmCommand(command: string, cwd: string) {
	// Determine the workspace folder path
	const workspaceFolder = vscode.workspace.workspaceFolders
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: null;

	if (workspaceFolder) {
		return runCommand(command, workspaceFolder);
	} else {
		return vscode.window.showErrorMessage("No workspace folder found. Please open a folder and try again.");
	}
}

/*
	Stores the github auth token
*/
async function storeToken(context: vscode.ExtensionContext) {
    const secretKey = 'githubAccessToken';
    const token = await vscode.window.showInputBox({ prompt: 'Enter your access token' });

    if (token) {
        await context.secrets.store(secretKey, token);
        vscode.window.showInformationMessage('Access token stored securely.');
    }
}

/*
	Retrieves the github auth token
*/
async function retrieveToken(context: vscode.ExtensionContext): Promise<string | undefined> {
    const secretKey = 'githubAccessToken';
    const token = await context.secrets.get(secretKey);

    return token;
}

/*
	Clears all secrets
*/
async function clearAllSecrets(context: vscode.ExtensionContext) {
    for (const key of secretKeys) {
        await context.secrets.delete(key);
    }
    vscode.window.showInformationMessage('All secrets have been cleared.');
}

/*
	Auths npm
*/
async function configureNpmrc(token: string): Promise<void> {
    const npmrcPath = path.join(os.homedir(), '.npmrc');
    const scope = '@supersocial';
    const registry = 'https://npm.pkg.github.com';
    const authLine = `${scope}:registry=${registry}\n//npm.pkg.github.com/:_authToken=${token}\n`;

    fs.appendFile(npmrcPath, authLine, (err) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to configure npm.');
            console.error(err);
            return;
        }
        vscode.window.showInformationMessage('npm configured successfully.');
    });
}

/*
	Fetches all packages from the org
*/
async function fetchAllPackages(octokit: any): Promise<any[]> {
	const response = await octokit.packages.listPackagesForOrganization({
		package_type: 'npm',
		org: 'Supersocial',
		per_page: 100
	});

	return response.data;
}

/*
	Gets the current repo's dependencies
*/
function getCurrentRepoDependencies(workspaceRoot: string): any[] {
	const packageJsonPath = path.join(workspaceRoot, 'package.json');
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	const deps = packageJson.dependencies
		? Object.keys(packageJson.dependencies).map((dep) => {
			const currentVersion = packageJson.dependencies[dep];
			return { dep, currentVersion };
		})
		: [];

	return deps;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const credentials = new Credentials();
	await credentials.initialize(context);

	initResources(context);

	const octokit = await credentials.getOctokit();
	const workspaceRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined) as string;
	
	// content providers
	const npmDependenciesProvider = new NodeDependenciesProvider(workspaceRoot, octokit!);
	const orionPackagesProvider  = new OrionPackagesProvider(workspaceRoot, octokit);
	const githubContentProvider = new GitHubContentProvider();

	const installedPackagesProvider = new NodeDependenciesProvider(workspaceRoot, octokit);	
	const githubRepoContentProvider = new GitHubRepoContentProvider(octokit);

	// orion
    vscode.window.registerTreeDataProvider('orionPackagesView', orionPackagesProvider);
	context.subscriptions.push(vscode.commands.registerCommand('orionPackages.refresh', () => orionPackagesProvider.refresh()));

	// npm dependencies
	vscode.window.registerTreeDataProvider('npmDependenciesView', npmDependenciesProvider);
	context.subscriptions.push(vscode.commands.registerCommand('npmDependencies.refresh', () => npmDependenciesProvider.refresh()));

	context.subscriptions.push(vscode.commands.registerCommand('npmDependencies.updateDependency', (item: vscode.TreeItem) => {
		vscode.window.showInformationMessage(`Updating ${item.label}...`);

		runNpmCommand(`npm install ${(item as any).fullName}@latest`, workspaceRoot).then((result) => {
			npmDependenciesProvider.refresh();
			vscode.window.showInformationMessage(`Updated ${item.label}`);
		}).catch((error) => {
			vscode.window.showErrorMessage(`Failed to update ${item.label}: ${error}`);
		});
	}));

	vscode.commands.registerCommand('npmDependencies.installDependency', (node) => {
        const packageName = node.label;
		
		// feedback
		vscode.window.showInformationMessage(`Installing ${packageName}`);

		// run the command
		runNpmCommand(`npm install @supersocial/${packageName}`, workspaceRoot).then((result) => {
			orionPackagesProvider.refresh();
			npmDependenciesProvider.refresh();
			vscode.window.showInformationMessage(`Installed ${packageName}`);
		}).catch((error) => {
			vscode.window.showErrorMessage(`Failed to install ${packageName}: ${error}`);
		});
    });

	vscode.commands.registerCommand('npmDependencies.uninstallDependency', (node) => {
        const packageName = node.label;
		
		// feedback
		vscode.window.showInformationMessage(`Uninstalling ${packageName}`);

		// run the command
		runNpmCommand(`npm uninstall @supersocial/${packageName}`, workspaceRoot).then((result) => {
			npmDependenciesProvider.refresh();
			orionPackagesProvider.refresh();
			vscode.window.showInformationMessage(`Uninstalled ${packageName}`);
		}).catch((error) => {
			vscode.window.showErrorMessage(`Failed to uninstall ${packageName}: ${error}`);
		});
    });

	// github file viewing
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('github', githubContentProvider));
	context.subscriptions.push(vscode.commands.registerCommand('orion.viewGitHubFileContent', async (downloadUrl) => {
		// Parse the URL to get the pathname, then extract the filename
		const parsedUrl = new URL(downloadUrl);
		const pathname = parsedUrl.pathname;
		const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
	
		// Use the filename in the URI for the virtual document
		const uri = vscode.Uri.from({
			scheme: 'github',
			path: filename,
			query: encodeURIComponent(downloadUrl)
		});

		const doc = await vscode.workspace.openTextDocument(uri); // Request VS Code to open the virtual document
		await vscode.window.showTextDocument(doc, { preview: true });
	}));	

	// github token / NPM
	context.subscriptions.push(vscode.commands.registerCommand('orion.clearAllSecrets', () => clearAllSecrets(context)));
	context.subscriptions.push(vscode.commands.registerCommand('orion.addGitHubToken', async () => {
		await storeToken(context);
		vscode.commands.executeCommand('orion.authNpm');
	}));

	// handles requests to re-auth NPM
	context.subscriptions.push(vscode.commands.registerCommand('orion.authNpm', () => {
		retrieveToken(context).then(async (token) => {
			if (!token) {
				return;
			}

			// if the token exists we can auth npm
			vscode.window.showInformationMessage('Authenticating NPM...');

			// configure npm
			configureNpmrc(token).then(() => {
				vscode.window.showInformationMessage(`Successfully authenticated NPM`);
			}).catch((error) => {
				vscode.window.showErrorMessage(`Failed to authenticate NPM ${error}`);
			});
		});
	}));

	// warn if no token
	retrieveToken(context).then((token) => {
		if (!token) {
			vscode.window.showInformationMessage('No GitHub token found. Please add one to use Orion');
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
