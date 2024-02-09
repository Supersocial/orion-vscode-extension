import * as vscode from 'vscode';
import axios from 'axios';

class GitHubContentProvider implements vscode.TextDocumentContentProvider {
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const downloadUrl = decodeURIComponent(decodeURIComponent(uri.query));

        try {
            const response = await axios.get(downloadUrl, {
                headers: { 'Accept': 'application/vnd.github.v3.raw' }, // Optional: GitHub API header for raw content
            });
            return response.data; // Return the file content as a string
        } catch (error) {
            console.error(`Failed to fetch file from GitHub: ${error}`);
            vscode.window.showErrorMessage('Failed to load the file from GitHub.');
            return ''; // Return an empty string or some error message to display in the document
        }
    }
}

export default GitHubContentProvider;