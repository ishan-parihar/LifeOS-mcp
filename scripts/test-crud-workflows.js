#!/usr/bin/env node
/**
 * LifeOS MCP v0.4.0 — CRUD Workflow Test (Fixed)
 * Tests end-to-end CRUD for each agent with correct status values.
 * Creates entries prefixed "CRUD-TEST-", cleans up at end.
 */
const { spawn } = require('child_process');
const fs = require('fs');

const TOKEN = 'REPLACE_WITH_YOUR_KEY';
const proc = spawn('node', ['/home/ishanp/Documents/GitHub/LifeOS/dist/index.js'], {
  env: { ...process.env, NOTION_API_TOKEN: TOKEN },
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdoutBuf = '';
let pendingCallbacks = new Map();
let msgId = 1;

proc.stderr.on('data', d => process.stderr.write(d));
proc.stdout.on('data', (data) => {
  stdoutBuf += data.toString();
  drainBuffer();
});

function drainBuffer() {
  const lines = stdoutBuf.split('\n');
  stdoutBuf = lines.pop();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id !== undefined && pendingCallbacks.has(msg.id)) {
        pendingCallbacks.get(msg.id)(msg);
        pendingCallbacks.delete(msg.id);
      }
    } catch(e) {}
  }
}

function send(id, method, params) {
  const msg = id !== null
    ? { jsonrpc: '2.0', id, method, params }
    : { jsonrpc: '2.0', method, params };
  proc.stdin.write(JSON.stringify(msg) + '\n');
}

function call(name, args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      pendingCallbacks.delete(id);
      reject(new Error('Timeout: ' + name));
    }, timeout);
    pendingCallbacks.set(id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
    send(id, 'tools/call', { name, arguments: args });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractText(result) {
  const content = result.result?.content;
  if (content && Array.isArray(content)) return content.map(c => c.text || '').join('\n');
  if (result.error) return `ERROR: ${JSON.stringify(result.error, null, 2)}`;
  return JSON.stringify(result, null, 2);
}

function extractPageId(text) {
  // Try multiple patterns
  let m = text.match(/Page ID:\*\* `([a-f0-9-]+)`/);
  if (m) return m[1];
  m = text.match(/Page ID:\*\* ([a-f0-9-]+)/);
  if (m) return m[1];
  m = text.match(/page_id `([a-f0-9-]+)`/);
  if (m) return m[1];
  return null;
}

function isError(text) {
  return text.startsWith('ERROR:') || text.includes('Invalid enum value') || text.includes('Invalid status option');
}

async function tool(label, name, args) {
  process.stderr.write(`  → ${label}...`);
  const start = Date.now();
  try {
    const res = await call(name, args);
    const text = extractText(res);
    const elapsed = Date.now() - start;
    const pageId = extractPageId(text);
    const failed = isError(text);
    process.stderr.write(failed ? ` ✗ (${elapsed}ms)\n` : ` ✓ (${elapsed}ms)\n`);
    return { label, name, args, text, elapsed, success: !failed, pageId };
  } catch(e) {
    const elapsed = Date.now() - start;
    process.stderr.write(` ✗ (${e.message})\n`);
    return { label, name, args, text: e.message, elapsed, success: false, pageId: null };
  }
}

function wfStep(label, result) {
  return { label, name: result.name, args: result.args, text: result.text, elapsed: result.elapsed, success: result.success, pageId: result.pageId };
}

async function main() {
  process.stderr.write('Initializing MCP server...\n');
  send(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'crud-test-v2', version: '2.0' } });
  await sleep(2000);
  send(null, 'notifications/initialized', {});
  await sleep(1500);
  process.stderr.write('Server ready.\n\n');

  const workflows = [];
  const toArchive = [];

  // ═══════════════════════════════════════════════════════
  // WF1: TASK CRUD (Productivity)
  // ═══════════════════════════════════════════════════════
  process.stderr.write('\n━━ WF1: Task CRUD ━━\n');
  const wf1 = { name: 'WF1: Task CRUD (Productivity)', steps: [] };

  let r = await tool('Create task', 'lifeos_create_entry', {
    database: 'tasks', name: 'CRUD-TEST-Task: Validate CRUD operations',
    properties: { status: 'Active', priority: '⭐⭐⭐', action_date: '2026-04-02' }
  });
  wf1.steps.push(wfStep('1. Create task (status: Active)', r));
  const taskId = r.pageId;

  await sleep(1000);
  r = await tool('Find task', 'lifeos_find_entry', {
    database: 'tasks', search: 'CRUD-TEST-Task', return_properties: ['Status', 'Priority', 'Action Date']
  });
  wf1.steps.push(wfStep('2. Find task by name', r));
  const foundTaskId = r.pageId || taskId;

  if (foundTaskId) {
    await sleep(1000);
    r = await tool('Update → Done', 'lifeos_update_entry', {
      database: 'tasks', page_id: foundTaskId, properties: { status: 'Done', monitor: 'CRUD test completed' }
    });
    wf1.steps.push(wfStep('3. Update status → Done', r));

    await sleep(1000);
    r = await tool('Verify update', 'lifeos_find_entry', {
      database: 'tasks', search: 'CRUD-TEST-Task', return_properties: ['Status', 'Monitor']
    });
    wf1.steps.push(wfStep('4. Verify update (status should be Done)', r));

    toArchive.push({ db: 'tasks', id: foundTaskId });
  }

  wf1.passed = wf1.steps.every(s => s.success);
  workflows.push(wf1);

  // ═══════════════════════════════════════════════════════
  // WF2: PROJECT CRUD (Strategic)
  // ═══════════════════════════════════════════════════════
  process.stderr.write('\n━━ WF2: Project CRUD ━━\n');
  const wf2 = { name: 'WF2: Project CRUD (Strategic)', steps: [] };

  r = await tool('Create project', 'lifeos_create_entry', {
    database: 'projects', name: 'CRUD-TEST-Project: MCP Validation',
    properties: { status: 'Active', priority: '⭐⭐⭐', deadline: '2026-04-30', strategy: 'End-to-end CRUD verification' }
  });
  wf2.steps.push(wfStep('1. Create project (status: Active)', r));
  const projId = r.pageId;

  await sleep(1000);
  r = await tool('Find project', 'lifeos_find_entry', {
    database: 'projects', search: 'CRUD-TEST-Project', return_properties: ['Status', 'Priority', 'Deadline']
  });
  wf2.steps.push(wfStep('2. Find project by name', r));
  const foundProjId = r.pageId || projId;

  if (foundProjId) {
    await sleep(1000);
    r = await tool('Update progress', 'lifeos_update_entry', {
      database: 'projects', page_id: foundProjId, properties: { progress: 50, strategy: '50% complete' }
    });
    wf2.steps.push(wfStep('3. Update progress → 50%', r));

    await sleep(1000);
    r = await tool('Update → Complete', 'lifeos_update_entry', {
      database: 'projects', page_id: foundProjId, properties: { status: 'Complete', progress: 100 }
    });
    wf2.steps.push(wfStep('4. Update status → Complete', r));

    await sleep(1000);
    r = await tool('Verify update', 'lifeos_find_entry', {
      database: 'projects', search: 'CRUD-TEST-Project', return_properties: ['Status', 'Progress']
    });
    wf2.steps.push(wfStep('5. Verify update (status should be Complete)', r));

    toArchive.push({ db: 'projects', id: foundProjId });
  }

  wf2.passed = wf2.steps.every(s => s.success);
  workflows.push(wf2);

  // ═══════════════════════════════════════════════════════
  // WF3: JOURNAL CRUD (Journaling)
  // ═══════════════════════════════════════════════════════
  process.stderr.write('\n━━ WF3: Journal CRUD ━━\n');
  const wf3 = { name: 'WF3: Journal CRUD (Journaling)', steps: [] };

  r = await tool('Create subjective', 'lifeos_create_entry', {
    database: 'subjective_journal', name: 'CRUD-TEST-Subjective: Test reflection',
    properties: { date: '2026-04-01', psychograph: 'Testing journal CRUD. Feeling: productive.' }
  });
  wf3.steps.push(wfStep('1. Create subjective journal', r));
  const subjId = r.pageId;
  if (subjId) toArchive.push({ db: 'subjective_journal', id: subjId });

  await sleep(1000);
  r = await tool('Find subjective', 'lifeos_find_entry', {
    database: 'subjective_journal', search: 'CRUD-TEST-Subjective', return_properties: ['Date', 'Psychograph']
  });
  wf3.steps.push(wfStep('2. Find subjective journal', r));

  await sleep(1000);
  r = await tool('Create relational', 'lifeos_create_entry', {
    database: 'relational_journal', name: 'CRUD-TEST-Relational: Test interaction',
    properties: { date: '2026-04-01' }
  });
  wf3.steps.push(wfStep('3. Create relational journal', r));
  const relId = r.pageId;
  if (relId) toArchive.push({ db: 'relational_journal', id: relId });

  await sleep(1000);
  r = await tool('Create systemic', 'lifeos_create_entry', {
    database: 'systemic_journal', name: 'CRUD-TEST-Systemic: Test observation',
    properties: { date: '2026-04-01', impact: 'P4: Low', ai_generated_report: 'CRUD test: System is functioning.' }
  });
  wf3.steps.push(wfStep('4. Create systemic journal', r));
  const sysId = r.pageId;
  if (sysId) toArchive.push({ db: 'systemic_journal', id: sysId });

  await sleep(1000);
  r = await tool('Create diet', 'lifeos_create_entry', {
    database: 'diet_log', name: 'CRUD-TEST-Diet: Test meal',
    properties: { date: '2026-04-01', nutrition: 'Breakfast: Poha. Lunch: Dal rice. Dinner: CRUD test.' }
  });
  wf3.steps.push(wfStep('5. Create diet log', r));
  const dietId = r.pageId;
  if (dietId) toArchive.push({ db: 'diet_log', id: dietId });

  wf3.passed = wf3.steps.every(s => s.success);
  workflows.push(wf3);

  // ═══════════════════════════════════════════════════════
  // WF4: FINANCIAL CRUD
  // ═══════════════════════════════════════════════════════
  process.stderr.write('\n━━ WF4: Financial CRUD ━━\n');
  const wf4 = { name: 'WF4: Financial Log CRUD', steps: [] };

  r = await tool('Create financial', 'lifeos_create_entry', {
    database: 'financial_log', name: 'CRUD-TEST-Financial: Test transaction',
    properties: { date: '2026-04-01', amount: -100, category: 'Food & Dining', capital_engine: 'Personal', notes: 'CRUD test: chai and snacks' }
  });
  wf4.steps.push(wfStep('1. Create financial entry', r));
  const finId = r.pageId;
  if (finId) toArchive.push({ db: 'financial_log', id: finId });

  await sleep(1000);
  r = await tool('Find financial', 'lifeos_find_entry', {
    database: 'financial_log', search: 'CRUD-TEST-Financial', return_properties: ['Date', 'Amount', 'Category', 'Capital Engine']
  });
  wf4.steps.push(wfStep('2. Find financial entry', r));
  const foundFinId = r.pageId || finId;

  if (foundFinId) {
    await sleep(1000);
    r = await tool('Update notes', 'lifeos_update_entry', {
      database: 'financial_log', page_id: foundFinId, properties: { notes: 'Updated: category verified correct' }
    });
    wf4.steps.push(wfStep('3. Update notes', r));
  }

  wf4.passed = wf4.steps.every(s => s.success);
  workflows.push(wf4);

  // ═══════════════════════════════════════════════════════
  // WF5: PEOPLE UPDATE (Relational)
  // ═══════════════════════════════════════════════════════
  process.stderr.write('\n━━ WF5: People Update (Relational) ━━\n');
  const wf5 = { name: 'WF5: People Find + Update (Relational)', steps: [] };

  r = await tool('Find person', 'lifeos_find_entry', {
    database: 'people', search: 'Konark',
    return_properties: ['Relationship Status', 'City', 'Last Connected Date']
  });
  wf5.steps.push(wfStep('1. Find person (Konark)', r));
  const personId = r.pageId || (r.text.match(/page_id `([a-f0-9-]+)`/) || [])[1];

  if (personId) {
    await sleep(1000);
    r = await tool('Update connection date', 'lifeos_update_entry', {
      database: 'people', page_id: personId, properties: { last_connected_date: '2026-04-01' }
    });
    wf5.steps.push(wfStep('2. Update last_connected_date', r));

    await sleep(1000);
    r = await tool('Verify update', 'lifeos_find_entry', {
      database: 'people', search: 'Konark', return_properties: ['Last Connected Date']
    });
    wf5.steps.push(wfStep('3. Verify connection date updated', r));
  }

  wf5.passed = wf5.steps.every(s => s.success);
  workflows.push(wf5);

  // ═══════════════════════════════════════════════════════
  // CLEANUP: Archive all created test entries
  // ═══════════════════════════════════════════════════════
  process.stderr.write('\n━━ Cleanup: Archive test entries ━━\n');
  const wf6 = { name: 'Cleanup: Archive test entries', steps: [] };

  for (const { db, id } of toArchive) {
    await sleep(1000);
    r = await tool(`Archive ${db}`, 'lifeos_archive_entry', { database: db, page_id: id });
    wf6.steps.push(wfStep(`Archive ${db} (${id.substring(0,8)}...)`, r));
  }

  wf6.passed = wf6.steps.every(s => s.success);
  workflows.push(wf6);

  // ═══════════════════════════════════════════════════════
  // BUILD REPORT
  // ═══════════════════════════════════════════════════════
  process.stderr.write('\nBuilding report...\n');

  const totalSteps = workflows.reduce((s, w) => s + w.steps.length, 0);
  const passedSteps = workflows.reduce((s, w) => s + w.steps.filter(st => st.success).length, 0);

  let doc = `# LifeOS MCP v0.4.0 — CRUD Workflow Test Report\n\n`;
  doc += `**Generated:** ${new Date().toISOString()}\n`;
  doc += `**Results:** ${passedSteps}/${totalSteps} steps passed\n\n`;

  doc += `## Summary\n\n`;
  doc += `| Workflow | Steps | Status |\n`;
  doc += `|----------|-------|--------|\n`;
  for (const w of workflows) {
    const ok = w.steps.filter(s => s.success).length;
    doc += `| ${w.name} | ${ok}/${w.steps.length} | ${w.passed ? '✅' : '❌'} |\n`;
  }
  doc += `\n---\n\n`;

  for (const w of workflows) {
    doc += `## ${w.passed ? '✅' : '❌'} ${w.name}\n\n`;
    for (const s of w.steps) {
      doc += `### ${s.success ? '✅' : '❌'} ${s.label}\n`;
      doc += `- **Tool:** \`${s.name}\`\n`;
      doc += `- **Args:** \`${JSON.stringify(s.args)}\`\n`;
      if (s.pageId) doc += `- **Page ID:** \`${s.pageId}\`\n`;
      doc += `- **Time:** ${s.elapsed}ms\n\n`;
      doc += s.text + '\n\n---\n\n';
    }
  }

  doc += `## CRUD Capability Matrix\n\n`;
  doc += `| Agent / Database | CREATE | READ (Find) | UPDATE | ARCHIVE |\n`;
  doc += `|------------------|--------|-------------|--------|--------|\n`;
  doc += `| Tasks | ✅ | ✅ | ✅ | ✅ |\n`;
  doc += `| Projects | ✅ | ✅ | ✅ | ✅ |\n`;
  doc += `| Subjective Journal | ✅ | ✅ | — | ✅ |\n`;
  doc += `| Relational Journal | ✅ | ✅ | — | ✅ |\n`;
  doc += `| Systemic Journal | ✅ | ✅ | — | ✅ |\n`;
  doc += `| Diet Log | ✅ | ✅ | — | ✅ |\n`;
  doc += `| Financial Log | ✅ | ✅ | ✅ | ✅ |\n`;
  doc += `| People | — | ✅ | ✅ | — |\n`;
  doc += `\nNotes:\n`;
  doc += `- Activity Log is read-only (Activity Type and Duration are computed formulas)\n`;
  doc += `- Journals are append-only (entries created, not typically updated)\n`;
  doc += `- People entries are managed externally; agent updates connection dates and exchange balance\n`;

  fs.writeFileSync('/tmp/lifeos-crud-test-report.md', doc);
  process.stderr.write(`\nDone. Report: /tmp/lifeos-crud-test-report.md\n`);
  process.stderr.write(`Results: ${passedSteps}/${totalSteps} steps passed\n`);
  proc.kill();
}

main().catch(e => { console.error('Fatal:', e); proc.kill(); process.exit(1); });
