// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Credentials } from './credentials';
import GitHubContentProvider from "./providers/GitHubContentProvider";
import OrionTemplateProvider from './providers/OrionTemplateProvider';
import OrionPackagesProvider from './providers/OrionPackagesProvider';
import NodeDependenciesProvider from './providers/NodeDependenciesProvider';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initResources } from './icons';
import FuzzySearch from 'fuzzy-search';
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
    });
}



// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const credentials = new Credentials();
	await credentials.initialize(context);

	if (!vscode.workspace.workspaceFolders && !vscode.workspace.workspaceFile) {
		vscode.window.showWarningMessage('Orion requires an open workspace to function');
		
		return;
	}

	initResources(context);

	const octokit = await credentials.getOctokit();
	const workspaceRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined) as string;
	
	// content providers
	const npmDependenciesProvider = new NodeDependenciesProvider(workspaceRoot, octokit!);
	const orionPackagesProvider  = new OrionPackagesProvider(workspaceRoot, octokit);
	const githubContentProvider = new GitHubContentProvider();

	const installedPackagesProvider = new NodeDependenciesProvider(workspaceRoot, octokit);	
	const orionTemplateProvider = new OrionTemplateProvider(octokit);

	vscode.window.registerTreeDataProvider('orionTemplatesView', orionTemplateProvider);
	context.subscriptions.push(vscode.commands.registerCommand('orionTemplates.refresh', () => orionTemplateProvider.refresh()));

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
			vscode.window.showInformationMessage(`Installed!`);
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
			vscode.window.showInformationMessage(`Uninstalled!`);
		}).catch((error) => {
			vscode.window.showErrorMessage(`Failed to uninstall ${packageName}: ${error}`);
		});
    });

	vscode.commands.registerCommand('npmDependencies.installDependencyVersion', (node) => {
		const packageName = node.packageName;
		const packageVersion = node.name;

		// feedback
		vscode.window.showInformationMessage(`Installing ${packageName}@${packageVersion}`);

		// run the command
		runNpmCommand(`npm install @supersocial/${packageName}@${packageVersion}`, workspaceRoot).then((result) => {
			npmDependenciesProvider.refresh();
			orionPackagesProvider.refresh();
			vscode.window.showInformationMessage(`Installed!`);
		}).catch((error) => {
			vscode.window.showErrorMessage(`Failed to install ${packageName}@${packageVersion}: ${error}`);
		});
	});

	vscode.commands.registerCommand('npmDependencies.syncWithPackageLock', () => {
		// feedback
		vscode.window.showInformationMessage('Syncing node_modules with package-lock.json...');

		runNpmCommand('npm clean-install', workspaceRoot).then((result) => {
			npmDependenciesProvider.refresh();
			orionPackagesProvider.refresh();
			vscode.window.showInformationMessage('Synced with package-lock.json');
		}).catch((error) => {
			vscode.window.showErrorMessage(`Failed to sync with package-lock.json: ${error}`);
		});
	});

	// vscode.commands.registerCommand('npmDependencies.loadREADME', async (downloadUrl) => {
	// 	const packageName = node.packageName;
	// 	const packagePath = `src/${packageName}/README.md`;

	// 	const uri = vscode.Uri.from({
	// 		scheme: 'github',
	// 		path: 'README.md',
	// 		query: encodeURIComponent(packagePath)
	// 	});

	// 	const doc = await vscode.workspace.openTextDocument(uri)
	// 	await vscode.window.showTextDocument(doc, { preview: true });
	// });

	// github file viewing
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('github', githubContentProvider));
	context.subscriptions.push(vscode.commands.registerCommand('orion.viewGitHubFileContent', async (info) => {

		if (info.type === 'githubFile') {
			const downloadUrl = info.downloadUrl;

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

			const doc = await vscode.workspace.openTextDocument(uri)
			await vscode.window.showTextDocument(doc, { preview: true });
		} else if (info.type === 'fileByName') {
			const filePath = info.filePath;

			console.log('fetching file', filePath);

			// fetch the readme
			const response = await octokit.request(filePath, {
				headers: {
					'X-GitHub-Api-Version': '2022-11-28'
				}
			});

			const downloadUrl = response.data.download_url;

			// Parse the URL to get the pathname, then extract the filename
			const uri = vscode.Uri.from({
				scheme: 'github',
				path: filePath,
				query: encodeURIComponent(downloadUrl)
			});

			const doc = await vscode.workspace.openTextDocument(uri);
			await vscode.window.showTextDocument(doc, {
				preview: true,
			});
		}
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

	// search for orion packages
	context.subscriptions.push(vscode.commands.registerCommand('orion.searchPackages', async () => {
		// fetch packages\
		const result = await vscode.window.showQuickPick(orionPackagesProvider.getPackages().then((packages) => {
			return packages
				.map((packageInfo: any) => packageInfo.name)
				.sort((a: any, b: any) => a.localeCompare(b));
		}), {
			placeHolder: 'Search for a package',
		});

		// if the user selected a package
		if (result) {
			// open the package
			vscode.commands.executeCommand('npmDependencies.installDependency', {label: result});
		}
	}));

	// warn if no token
	retrieveToken(context).then((token) => {
		if (!token) {
			vscode.window.showWarningMessage('No GitHub token found. Orion may not work as expected.');
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
