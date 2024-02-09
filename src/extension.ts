// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as url from 'url';
import { Credentials } from './credentials';
import NpmDependenciesProvider from "./providers/NpmDependenciesProvider";
import PackagesContentProvider from "./providers/PackagesContentProvider";
import GitHubContentProvider from "./providers/GitHubContentProvider";
import * as childProcess from 'child_process';

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

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const credentials = new Credentials();
	await credentials.initialize(context);

	const octokit = await credentials.getOctokit();
	const workspaceRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined) as string;
	
	// content providers
	const npmDependenciesProvider = new NpmDependenciesProvider(workspaceRoot, octokit!);
	const packageContentProvider = new PackagesContentProvider(workspaceRoot, octokit);
	const githubContentProvider = new GitHubContentProvider();

	// register
    vscode.window.registerTreeDataProvider('npmDependenciesView', npmDependenciesProvider);
    vscode.window.registerTreeDataProvider('availablePackagesView', packageContentProvider);

	context.subscriptions.push(vscode.commands.registerCommand('orion.npmUpdateDependency', (item: vscode.TreeItem) => {
		vscode.window.showInformationMessage(`Updating ${item.label}...`);
	}));

	vscode.commands.registerCommand('orion.npmInstallDependency', (node) => {
        const packageName = node.label;
		
		// feedback
		vscode.window.showInformationMessage(`Installing ${packageName}`);

		// run the command
		runNpmCommand(`npm install @supersocial/${packageName}`, workspaceRoot).then((result) => {
			packageContentProvider.refresh();
			vscode.window.showInformationMessage(`Installed ${packageName}`);
		}).catch((error) => {
			vscode.window.showErrorMessage(`Failed to install ${packageName}: ${error}`);
		});
    });

	vscode.commands.registerCommand('orion.npmUninstallDependency', (node) => {
        const packageName = node.label;
		
		// feedback
		vscode.window.showInformationMessage(`Uninstalling ${packageName}`);

		// run the command
		runNpmCommand(`npm uninstall @supersocial/${packageName}`, workspaceRoot).then((result) => {
			packageContentProvider.refresh();
			vscode.window.showInformationMessage(`Uninstalled ${packageName}`);
		}).catch((error) => {
			vscode.window.showErrorMessage(`Failed to uninstall ${packageName}: ${error}`);
		});
    });
	
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

	const response = await octokit.packages.getAllPackageVersionsForPackageOwnedByOrg({
		package_type: 'npm',
		package_name: 'baseobject',
		org: 'Supersocial'
	});

	console.log(response);

	// // handle github auth
	// const userInfo = await octokit.users.getAuthenticated();
	// vscode.window.showInformationMessage(`Hello ${userInfo.data.login}!`);

	// const response = await octokit.request('/repos/Supersocial/Orion/contents', {
	// 	headers: {
	// 		'X-GitHub-Api-Version': '2022-11-28'
	// 	}
	// })

	// console.log(response.data);
}

// This method is called when your extension is deactivated
export function deactivate() {}
