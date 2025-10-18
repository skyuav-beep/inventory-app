#!/usr/bin/env node
/**
 * PostgreSQL database backup helper.
 *
 * Usage:
 *   node scripts/backup-database.js [--out-dir ./backups] [--format custom|plain] [--name custom-file-name]
 *
 * Requirements:
 *   - pg_dump must be installed and available on PATH.
 *   - DATABASE_URL environment variable must be set (e.g. in .env).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, '..', 'backups');
const SUPPORTED_FORMATS = new Set(['custom', 'plain']);

function parseArgs(argv) {
  const result = {
    outDir: DEFAULT_OUTPUT_DIR,
    format: 'custom',
    name: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out-dir' || arg === '-o') {
      result.outDir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--out-dir=')) {
      result.outDir = path.resolve(process.cwd(), arg.split('=')[1]);
    } else if (arg === '--format' || arg === '-f') {
      result.format = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--format=')) {
      result.format = arg.split('=')[1];
    } else if (arg === '--name' || arg === '-n') {
      result.name = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--name=')) {
      result.name = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  if (!SUPPORTED_FORMATS.has(result.format)) {
    console.error(`Unsupported format "${result.format}". Use one of: ${Array.from(SUPPORTED_FORMATS).join(', ')}`);
    process.exit(1);
  }

  return result;
}

function printUsage() {
  console.log(`Usage: node scripts/backup-database.js [options]

Options:
  --out-dir, -o   Output directory for backup files (default: ./backups)
  --format,  -f   pg_dump format: "custom" (default) or "plain"
  --name,    -n   Custom file name without extension (timestamp used by default)
  --help,    -h   Show this help message`);
}

function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function getTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function buildFilePath(outDir, format, customName) {
  const baseName = customName ? customName.replace(/\s+/g, '-') : `backup-${getTimestamp()}`;
  const extension = format === 'plain' ? '.sql' : '.dump';
  return path.join(outDir, `${baseName}${extension}`);
}

function maskDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    return '';
  }

  try {
    const parsed = new URL(databaseUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '[hidden]';
  }
}

async function run() {
  const { outDir, format, name } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Please define it in your environment (e.g. .env file).');
    process.exit(1);
  }

  ensureDirectory(outDir);
  const filePath = buildFilePath(outDir, format, name);

  const maskedUrl = maskDatabaseUrl(databaseUrl);
  console.log(`Starting PostgreSQL backup`);
  console.log(`  Database: ${maskedUrl}`);
  console.log(`  Output:   ${filePath}`);
  console.log(`  Format:   ${format}`);

  const dumpArgs = [
    `--format=${format}`,
    '--no-owner',
    '--no-acl',
    '--clean',
    `--file=${filePath}`,
    `--dbname=${databaseUrl}`,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn('pg_dump', dumpArgs, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('pg_dump command not found. Please install PostgreSQL client tools or ensure pg_dump is on PATH.'));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_dump exited with code ${code}`));
      }
    });
  });

  console.log('Backup completed successfully.');
}

run().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exit(1);
});
