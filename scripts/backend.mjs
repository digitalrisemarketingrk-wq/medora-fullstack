import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cwd = path.join(root, 'backend');
const python = path.join(cwd, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const mode = process.argv[2] || 'dev';
const commands = { dev: ['run_live.py'], test: ['-m', 'pytest', '-q'], seed: ['seed_live_data.py'], check: ['check_live_services.py'] };
if (!(mode in commands)) throw new Error('Unknown backend command');
const child = spawn(python, [...commands[mode], ...process.argv.slice(3)], { cwd, stdio: 'inherit', windowsHide: true });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
