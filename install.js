#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const TOOLKIT_DIR = path.resolve(__dirname);
const CONFIG_DIR = path.join(os.homedir(), '.config', 'opencode');
const CONFIG_FILE = path.join(CONFIG_DIR, 'opencode.jsonc');
const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');
const RULES_DIR = path.join(CONFIG_DIR, 'rules');

const SKILLS_SOURCE = path.join(TOOLKIT_DIR, 'skills');
const RULES_SOURCE = path.join(TOOLKIT_DIR, 'rules');

function discoverSkills() {
  if (!fs.existsSync(SKILLS_SOURCE)) return [];
  return fs.readdirSync(SKILLS_SOURCE).filter(name => {
    const skillPath = path.join(SKILLS_SOURCE, name, 'SKILL.md');
    return fs.existsSync(skillPath) && fs.statSync(skillPath).isFile();
  });
}

function discoverRules() {
  if (!fs.existsSync(RULES_SOURCE)) return [];
  return fs.readdirSync(RULES_SOURCE).filter(name => name.endsWith('.md'));
}

function readSkillMeta(name) {
  const filePath = path.join(SKILLS_SOURCE, name, 'SKILL.md');
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return { name, description: '' };

  const lines = frontmatter[1].split('\n');
  const meta = {};
  let key = null;
  let valueLines = [];

  for (const line of lines) {
    const simpleMatch = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (simpleMatch) {
      if (key) meta[key] = valueLines.join(' ').trim();
      key = simpleMatch[1];
      const val = simpleMatch[2].trim();
      if (val === '>') {
        valueLines = [];
      } else {
        valueLines = [val];
      }
    } else if (key && line.startsWith('  ')) {
      valueLines.push(line.trim());
    }
  }
  if (key) meta[key] = valueLines.join(' ').trim();

  return { name, description: meta.description || '' };
}

function readRuleDescription(name) {
  const filePath = path.join(RULES_SOURCE, name);
  const content = fs.readFileSync(filePath, 'utf-8');
  const firstLine = content.split('\n')[0];
  return firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine;
}

function stripJSONC(content) {
  let result = '';
  let i = 0;
  const len = content.length;

  while (i < len) {
    const ch = content[i];

    // String - copy as-is (including // inside strings)
    if (ch === '"') {
      result += ch;
      i++;
      while (i < len && content[i] !== '"') {
        if (content[i] === '\\') {
          result += content[i] + content[i + 1];
          i += 2;
        } else {
          result += content[i];
          i++;
        }
      }
      if (i < len) {
        result += content[i]; // closing quote
        i++;
      }
    }
    // Line comment
    else if (ch === '/' && content[i + 1] === '/') {
      i += 2;
      while (i < len && content[i] !== '\n') i++;
    }
    // Block comment
    else if (ch === '/' && content[i + 1] === '*') {
      i += 2;
      while (i < len && !(content[i] === '*' && content[i + 1] === '/')) i++;
      if (i < len) i += 2;
    }
    else {
      result += ch;
      i++;
    }
  }

  // Remove trailing commas
  return result.replace(/,(?=\s*[}\]])/g, '');
}

function parseJSONC(content) {
  return JSON.parse(stripJSONC(content));
}

function serializeJSONC(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copySkill(name) {
  const src = path.join(SKILLS_SOURCE, name);
  const dest = path.join(SKILLS_DIR, name);
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(src, dest, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    return parseJSONC(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  ensureDir(CONFIG_DIR);
  fs.writeFileSync(CONFIG_FILE, serializeJSONC(config), 'utf-8');
}

function readLinesFromStdin() {
  return new Promise((resolve) => {
    const lines = [];
    let buffer = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      let idx = buffer.indexOf('\n');
      while (idx !== -1) {
        lines.push(buffer.slice(0, idx).trim());
        buffer = buffer.slice(idx + 1);
        if (lines.length >= 2) {
          process.stdin.removeAllListeners('data');
          process.stdin.removeAllListeners('end');
          resolve(lines);
          return;
        }
        idx = buffer.indexOf('\n');
      }
    });
    process.stdin.on('end', () => {
      if (buffer.trim()) lines.push(buffer.trim());
      resolve(lines);
    });
  });
}

async function readInput(prompt, stdinLines, lineIdx) {
  if (stdinLines.length > lineIdx) {
    return { value: stdinLines[lineIdx], idx: lineIdx + 1 };
  }
  return new Promise(resolve => {
    process.stdout.write(prompt);
    const onData = (chunk) => {
      process.stdin.removeListener('data', onData);
      resolve({ value: chunk.toString().trim(), idx: lineIdx + 1 });
    };
    process.stdin.on('data', onData);
  });
}

function getArgValue(args, flag) {
  for (const arg of args) {
    if (arg.startsWith(`${flag}=`)) return arg.split('=')[1];
    if (arg === flag) {
      const idx = args.indexOf(arg);
      if (idx + 1 < args.length) return args[idx + 1];
    }
  }
  return undefined;
}

function parseSelection(input, items) {
  if (input.toLowerCase() === 'all') {
    return items;
  }
  if (!input.trim()) return [];
  const indices = input.split(',')
    .map(s => parseInt(s.trim()) - 1)
    .filter(i => !isNaN(i) && i >= 0 && i < items.length);
  return indices.map(i => items[i]);
}

function showHelp() {
  process.stdout.write(`
  Opencode Toolkit Installer

  Usage: node install.js [options]

  Options:
    --help, -h              Show this help message
    --skills <list>         Comma-separated skill indices (e.g. 1,2) or "all"
    --rules <list>          Comma-separated rule indices (e.g. 1,3) or "all"
    --remove-skills <list>  Comma-separated skill indices or "all" to remove
    --remove-rules <list>   Comma-separated rule indices or "all" to remove

  Examples:
    node install.js                       # interactive mode
    node install.js --skills all --rules all
    node install.js --skills 1,3 --rules 2
    node install.js --remove-skills 1
    node install.js --remove-rules all
    echo -e "all\\nall" | node install.js  # non-interactive piped mode

`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const cliSkills = getArgValue(args, '--skills');
  const cliRules = getArgValue(args, '--rules');
  const cliRemoveSkills = getArgValue(args, '--remove-skills');
  const cliRemoveRules = getArgValue(args, '--remove-rules');

  process.stdout.write('\n  Opencode Toolkit Installer\n\n');

  const skills = discoverSkills().map(readSkillMeta);
  const rules = discoverRules().map(name => ({
    name,
    description: readRuleDescription(name)
  }));

  if (skills.length === 0 && rules.length === 0) {
    process.stdout.write('  No skills or rules found.\n\n');
    process.exit(0);
  }

  // Detect if stdin is piped
  const isPiped = !process.stdin.isTTY && !cliSkills && !cliRules &&
                  !cliRemoveSkills && !cliRemoveRules;
  let stdinLines = [];
  if (isPiped) {
    stdinLines = await readLinesFromStdin();
  }

  let lineIdx = 0;

  // Skill removal
  if (cliRemoveSkills !== undefined) {
    const toRemove = parseSelection(cliRemoveSkills, skills);
    for (const skill of toRemove) {
      const dest = path.join(SKILLS_DIR, skill.name);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
        process.stdout.write(`  ✓ Removed skill: ${skill.name}\n`);
      }
    }
  }

  // Rule removal
  if (cliRemoveRules !== undefined) {
    const toRemove = parseSelection(cliRemoveRules, rules);
    for (const rule of toRemove) {
      const dest = path.join(RULES_DIR, rule.name);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { force: true });
        process.stdout.write(`  ✓ Removed rule: ${rule.name}\n`);
      }
    }
  }

  // Skill selection
  let selectedSkills = [];
  if (skills.length > 0) {
    if (cliSkills !== undefined) {
      selectedSkills = parseSelection(cliSkills, skills);
    } else {
      process.stdout.write('  Available skills:\n\n');
      skills.forEach((item, i) => {
        process.stdout.write(`    ${i + 1}. ${item.name} — ${item.description}\n`);
      });
      process.stdout.write('\n');

      const { value: skillInput, idx: nextIdx } = await readInput(
        `  Skills to install (comma-separated, e.g. 1,2 or "all", empty to skip): `,
        stdinLines,
        lineIdx
      );
      lineIdx = nextIdx;
      if (skillInput.trim()) {
        selectedSkills = parseSelection(skillInput, skills);
      }
    }
  }

  // Rule selection
  let selectedRules = [];
  if (rules.length > 0) {
    if (cliRules !== undefined) {
      selectedRules = parseSelection(cliRules, rules);
    } else {
      process.stdout.write('\n  Available rules:\n\n');
      rules.forEach((item, i) => {
        process.stdout.write(`    ${i + 1}. ${item.name} — ${item.description}\n`);
      });
      process.stdout.write('\n');

      const { value: ruleInput, idx: nextIdx } = await readInput(
        `  Rules to install (comma-separated, e.g. 1,2 or "all", empty to skip): `,
        stdinLines,
        lineIdx
      );
      lineIdx = nextIdx;
      if (ruleInput.trim()) {
        selectedRules = parseSelection(ruleInput, rules);
      }
    }
  }

  if (selectedSkills.length === 0 && selectedRules.length === 0 &&
      cliRemoveSkills === undefined && cliRemoveRules === undefined) {
    process.stdout.write('\n  Nothing selected. Exiting.\n\n');
    process.exit(0);
  }

  // Load existing config
  const config = loadConfig();

  // Install skills
  if (selectedSkills.length > 0) {
    ensureDir(SKILLS_DIR);
    for (const skill of selectedSkills) {
      copySkill(skill.name);
      process.stdout.write(`  ✓ Copied skill: ${skill.name}\n`);
    }
  }

  // Install rules
  const installedRulePaths = [];
  if (selectedRules.length > 0) {
    ensureDir(RULES_DIR);
    for (const rule of selectedRules) {
      const dest = path.join(RULES_DIR, rule.name);
      copyFile(path.join(RULES_SOURCE, rule.name), dest);
      installedRulePaths.push(dest);
      process.stdout.write(`  ✓ Copied rule: ${rule.name}\n`);
    }
  }

  // Update config
  if (selectedSkills.length > 0) {
    if (!config.skills) config.skills = {};
    if (!config.skills.paths) config.skills.paths = [];
    if (!config.skills.paths.includes(SKILLS_DIR)) {
      config.skills.paths.push(SKILLS_DIR);
    }
  }

  if (installedRulePaths.length > 0) {
    if (!config.instructions) config.instructions = [];
    for (const rulePath of installedRulePaths) {
      if (!config.instructions.includes(rulePath)) {
        config.instructions.push(rulePath);
      }
    }
  }

  // Clean config entries for removed items
  if (cliRemoveSkills !== undefined) {
    if (config.skills && config.skills.paths) {
      const remaining = fs.existsSync(SKILLS_DIR) ? fs.readdirSync(SKILLS_DIR) : [];
      if (remaining.length === 0) {
        config.skills.paths = config.skills.paths.filter(p => p !== SKILLS_DIR);
      }
    }
  }

  if (cliRemoveRules !== undefined) {
    if (config.instructions) {
      const removedNames = new Set(parseSelection(cliRemoveRules, rules).map(r => r.name));
      config.instructions = config.instructions.filter(p => {
        const fileName = path.basename(p);
        return !removedNames.has(fileName);
      });
    }
  }

  saveConfig(config);
  process.stdout.write(`\n  ✓ Config updated: ${CONFIG_FILE}\n\n`);

  // Summary
  if (selectedSkills.length > 0 || selectedRules.length > 0 ||
      cliRemoveSkills !== undefined || cliRemoveRules !== undefined) {
    process.stdout.write('  Summary:\n');
    if (selectedSkills.length > 0) {
      process.stdout.write(`    Installed skills: ${selectedSkills.map(s => s.name).join(', ')}\n`);
    }
    if (selectedRules.length > 0) {
      process.stdout.write(`    Installed rules:  ${selectedRules.map(r => r.name).join(', ')}\n`);
    }
    if (cliRemoveSkills !== undefined) {
      const removed = parseSelection(cliRemoveSkills, skills);
      if (removed.length > 0) {
        process.stdout.write(`    Removed skills:   ${removed.map(s => s.name).join(', ')}\n`);
      }
    }
    if (cliRemoveRules !== undefined) {
      const removed = parseSelection(cliRemoveRules, rules);
      if (removed.length > 0) {
        process.stdout.write(`    Removed rules:    ${removed.map(r => r.name).join(', ')}\n`);
      }
    }
    process.stdout.write('\n');
  }
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  process.stderr.write(`  Error: ${err.message}\n`);
  process.exit(1);
});
