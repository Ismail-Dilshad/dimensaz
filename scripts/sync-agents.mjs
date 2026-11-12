// Generates the studio's sub-agents for every agent host from the organisation
// (agent/studio.yaml), so each host and the plans always describe the same roles:
//   Claude Code  .claude/agents/NAME.md   (Markdown, YAML front matter; sub-agents can nest)
//   Gemini CLI   .gemini/agents/NAME.md   (Markdown, YAML front matter; no nesting)
//   Codex        .codex/agents/NAME.toml  (TOML: name, description, developer_instructions)
// `--check` fails if a generated file is stale.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const notice = 'Generated from agent/studio.yaml by `pnpm agents:sync`. Edit the source, not this file.';
const list = items => items.map(x => '- ' + x).join('\n');
// The description is quoted: it contains colons, which unquoted YAML reads as keys.
const hosts = {
 claude: {dir: '.claude/agents', ext: 'md', file: a => `---\nname: ${a.name}\ndescription: ${JSON.stringify(a.description)}\nmodel: inherit\n${a.leaf ? 'disallowedTools: Agent\n' : ''}---\n\n<!-- ${notice} -->\n\n${a.body}`},
 gemini: {dir: '.gemini/agents', ext: 'md', file: a => `---\nname: ${a.name}\ndescription: ${JSON.stringify(a.description)}\nmodel: inherit\nmax_turns: 60\ntimeout_mins: 30\n---\n\n<!-- ${notice} -->\n\n${a.body}`},
 // TOML literal strings ('...' and '''...''') take the text as it is: no escapes to get wrong.
 codex: {dir: '.codex/agents', ext: 'toml', file: a => `# ${notice}\nname = ${JSON.stringify(a.name)}\ndescription = ${JSON.stringify(a.description)}\ndeveloper_instructions = '''\n${a.body}'''\n`},
};

const protocol = `## How every task runs

1. \`pnpm tempoloom studio start JOB TASK\` first. It returns the role's playbook (mission, steps,
   guides, commands, checks), the task's inputs (files made by earlier tasks), the lessons the
   brain has for this role and the user's feedback on this job. Read the inputs and the guides.
2. Apply every lesson marked \`always\`; use the others where they fit.
3. Do the task with the role's commands. Write the output to the \`writeTo\` path.
4. Check the output against the role's checks.
5. \`pnpm tempoloom studio done JOB TASK --output FILE --applied ID,ID\` (or \`--applied none\`),
   with \`--learned "what you would do again, with numbers"\` when the task taught something and
   \`--note "one line for the next role"\`.

Never talk to the user: only the Director does. Never approve a gate. Never skip \`studio start\`:
it is how the studio's lessons and the user's feedback reach you.`;

/** The studio's sub-agents, the same for every host: name, description, instructions. */
export function agents() {
 const s = parse(fs.readFileSync(path.join(root, 'agent/studio.yaml'), 'utf8'));
 const out = [];
 for (const d of s.departments.filter(x => x.lead)) {
  const lead = s.roles.find(r => r.id === d.lead), team = s.roles.filter(r => r.department === d.id && r.id !== d.lead);
  out.push({name: lead.agent, description: `${lead.title} of the Tempoloom studio. Use for a job's ${d.title.toLowerCase()} stage: give it the studio job name; it runs that department's ready tasks in order and reports back at each approval gate.`, body:
`# ${lead.title}

${lead.mission} Department: **${d.title}** - ${d.mission}

You are given a studio job name (JOB). Work through your department's tasks:

1. \`pnpm tempoloom studio next JOB\` lists the tasks that can start. Take those owned by your
   department${s.roles.some(r => r.department === 'shared') ? ' and the shared roles' : ''}, in order.
2. Do each one as below. If you can start a sub-agent yourself, hand a heavy task, or one that
   can run beside another, to \`tempoloom-specialist\` with the job and task names; otherwise do
   every task yourself, one at a time.
3. The review task is not yours: leave it for the Director to give to \`tempoloom-reviewer\`,
   and never review your own work.
4. Stop when \`next\` shows an approval waiting for the user, or nothing is ready. Report to the
   Director: what was done (task, output file, one line each), what is waiting, any problem.

${protocol}

## Your own task (the design)

${list(lead.steps)}

Checks:

${list(lead.checks)}

## Your team

${team.map(r => `- **${r.title}** (\`${r.id}\`): ${r.mission}`).join('\n')}

Read first: ${lead.guides.map(g => '`' + g + '`').join(', ')}.
`});
 }
 out.push({name: 'tempoloom-specialist', leaf: true, description: 'A Tempoloom studio specialist for one task of a job (research, script, style, scenes, sound, voice, build, footage analysis, cutting, finishing). Give it the studio job name and the task name; its role, playbook and lessons come from `studio start`.', body:
`# Studio specialist

You do one task of a Tempoloom studio job. You are given the job name (JOB) and the task name
(TASK). Your role for this task, its playbook and everything it has learned come from the
studio, not from this file:

${protocol}

Return a short report: the output file, the decisions you made and why, the lesson ids you
applied, anything you learned, and anything the next role must know. Roles you may be given:

${s.roles.filter(r => !r.agent).map(r => `- **${r.title}** (\`${r.id}\`): ${r.mission}`).join('\n')}
`});
 const rev = s.roles.find(r => r.independent);
 out.push({name: rev.agent, leaf: true, description: `Independent reviewer of the Tempoloom studio. Use after a preview or an edit is built: give it the studio job name and the review task name. It has not seen the work being made and says what is wrong and whose task fixes it.`, body:
`# ${rev.title}

${rev.mission}

You are given a studio job name (JOB) and the review task name (TASK, usually \`review\`).
You are independent: read the request, the approved script and the preview. Do not read the
makers' notes, and do not fix anything yourself.

${protocol}

## Your playbook

${list(rev.steps)}

Checks:

${list(rev.checks)}

## The review you write

\`\`\`markdown
# Review: JOB
Verdict: pass | fail
| Scene | Problem | Fix it in |
| --- | --- | --- |
| 3 | The visual repeats scene 2's layout | scenes |
Feedback rules checked: ID ok, ID broken (where)
\`\`\`

"Fix it in" names a role: ${s.roles.filter(r => !r.agent).map(r => '`' + r.id + '`').join(', ')}.
Read first: ${rev.guides.map(g => '`' + g + '`').join(', ')}.
`});
 return out;
}

/** Every generated file, by its path from the project root. */
export function render() {
 const out = {};
 for (const h of Object.values(hosts)) for (const a of agents()) out[`${h.dir}/${a.name}.${h.ext}`] = h.file(a);
 return out;
}


if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const check = process.argv.includes('--check');
 let stale = 0;
 for (const [rel, want] of Object.entries(render())) {
  const file = path.join(root, rel), have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (have === want) continue;
  if (check) { console.error('Stale: ' + rel + ' (run pnpm agents:sync)'); stale++; }
  else { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, want); console.log('Updated ' + rel); }
 }
 if (stale) process.exit(1);
}
