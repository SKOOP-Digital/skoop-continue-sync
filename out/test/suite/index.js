"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function run() {
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
            mocha.run((failures) => {
                if (failures > 0) {
                    e(new Error(`${failures} tests failed.`));
                }
                else {
                    c();
                }
            });
        }
        catch (err) {
            console.error(err);
            e(err);
        }
    });
}
exports.run = run;
function findTestFiles(dir) {
    const files = [];
    function scan(directory) {
        const items = fs.readdirSync(directory);
        for (const item of items) {
            const fullPath = path.join(directory, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory() && item !== 'node_modules') {
                scan(fullPath);
            }
            else if (stat.isFile() && item.endsWith('.test.js')) {
                files.push(fullPath);
            }
        }
    }
    scan(dir);
    return files;
}
//# sourceMappingURL=index.js.map