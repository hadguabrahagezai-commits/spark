import { analyzeProject } from '../src/core/self_modifier';

async function main(){
  console.log('Running JARVIS self-modifier analysis (dry-run)');
  const res = await analyzeProject(process.cwd() + '/src');
  console.log('Diagnostics:');
  console.log(res.diagnostics.join('\n') || '(none)');
  console.log('\nSuggestions:');
  console.log(JSON.stringify(res.suggestions, null, 2));
}

void main();
