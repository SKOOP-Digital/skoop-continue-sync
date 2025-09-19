import * as path from 'path';
import * as fs from 'fs';

export function run(): Promise<void> {
	// Create the mocha test
	const Mocha = require('mocha');
	const mocha = new Mocha({
		ui: 'tdd',
		color: true
	});

	const testsRoot = path.resolve(__dirname, '..');

	// Simple file discovery without glob
	const testFiles = findTestFiles(testsRoot);
	testFiles.forEach(file => mocha.addFile(file));

	return new Promise((c, e) => {
		try {
			// Run the mocha test
			mocha.run((failures: number) => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (err) {
			console.error(err);
			e(err);
		}
	});
}

function findTestFiles(dir: string): string[] {
	const files: string[] = [];

	function scan(directory: string) {
		const items = fs.readdirSync(directory);

		for (const item of items) {
			const fullPath = path.join(directory, item);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory() && item !== 'node_modules') {
				scan(fullPath);
			} else if (stat.isFile() && item.endsWith('.test.js')) {
				files.push(fullPath);
			}
		}
	}

	scan(dir);
	return files;
}
