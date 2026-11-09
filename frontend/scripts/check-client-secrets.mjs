import fs from 'node:fs';
import path from 'node:path';
const secretNames=['GROQ_API_KEY','SUPABASE_SECRET_KEY','QDRANT_API_KEY','EMBEDDING_API_KEY'];
const files=[];
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const filename=path.join(directory,entry.name);if(entry.isDirectory())walk(filename);else files.push(filename);}}
const clientDir = fs.existsSync('dist/client') ? 'dist/client' : (fs.existsSync('frontend/dist/client') ? 'frontend/dist/client' : 'dist/client');
walk(clientDir);
let failed=false;
for(const filename of files){const text=fs.readFileSync(filename).toString();for(const name of secretNames){const value=process.env[name];if(value&&text.includes(value)){console.error(`Server-only variable ${name} was found in a client asset.`);failed=true;}}}
if(failed)process.exit(1);
console.log(`Checked ${files.length} client assets: no configured server secret values found.`);
