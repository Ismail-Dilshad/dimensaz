import path from 'node:path';
import {parseArgs} from 'node:util';
import {ROOT} from '../engine/config.js';
import {produce} from '../engine/production.js';
import {writeJSON} from '../engine/project.js';
import type {DimensazState} from '../../agent/status/dimensaz-states.js';

async function updateStatus(state: DimensazState, detail: string) {
 try {
  await writeJSON(path.join(ROOT, '.dimensaz', 'state.json'), {
   state, detail, updated: Math.floor(Date.now() / 1000)
  });
 } catch (error) {
  console.error('Could not update Dimensaz status: ' + String(error));
 }
}

async function main() {
 try {
  const {values: v} = parseArgs({options: {
   manifest: {type: 'string'}, resume: {type: 'string'}, alignment: {type: 'string'},
   revision: {type: 'string'}, storyboard: {type: 'string'}, review: {type: 'string'},
   'legacy-style': {type: 'boolean'}, 'approve-preview': {type: 'boolean'}
  }});
  const result = await produce({
   manifest: v.manifest, resume: v.resume, alignment: v.alignment, revision: v.revision,
   storyboard: v.storyboard, review: v.review, legacyStyle: v['legacy-style'],
   approve: v['approve-preview'],
   onPhase: (phase, project) => updateStatus(
    phase, phase === 'planning' ? 'Planning scenes for ' + project : 'Rendering ' + project
   )
  });
  if (result.status === 'complete') {
   await updateStatus('done', 'Export verified for ' + result.job);
  } else {
   const detail = result.status === 'asset-review' ? 'Waiting for scene assets' :
    result.status === 'alignment-review' ? 'Waiting for narration alignment review' :
    result.status === 'pilot-review' ? 'Waiting for pilot review' : 'Waiting for preview review';
   await updateStatus('needs-approval', detail);
  }
  console.log(JSON.stringify(result, null, 2));
 } catch (error) {
  await updateStatus('error', 'Video production failed');
  console.error(JSON.stringify({status: 'failed', error: String(error)}));
  process.exitCode = 1;
 }
}

void main();
