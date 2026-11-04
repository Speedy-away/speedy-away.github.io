#!/usr/bin/env node
'use strict';
// Reads curated files only. It never starts the bridge, contacts a console or
// executes a payload. --write updates only the fixed JSON verification report.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {ROOT, loadActions, localFileFor, readVerifiedFile} = require('./console-payload-bridge.cjs');

const REPORT = 'docs/qa/host-payload-integrity.json';
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const issue = (code, message) => ({code, message});

function validateELF(data) {
  const issues = [], metadata = {bytes: data.length};
  const add = (code, message) => issues.push(issue(code, message));
  if (data.length < 64) {
    add('elf-header-truncated', 'The ELF64 header requires at least 64 bytes.');
    return {metadata, issues};
  }
  if (!data.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) add('elf-magic', 'The file does not start with ELF magic.');
  metadata.bits = data[4] === 2 ? 64 : data[4] === 1 ? 32 : null;
  metadata.endianness = data[5] === 1 ? 'little' : data[5] === 2 ? 'big' : null;
  if (metadata.bits !== 64) add('elf-class', 'The console payload must be a 64-bit ELF.');
  if (metadata.endianness !== 'little') add('elf-endianness', 'The console payload must use little-endian encoding.');
  if (data[6] !== 1) add('elf-ident-version', 'The ELF identification version must be 1.');
  // Other encodings cannot be parsed with the ELF64 little-endian offsets below.
  if (issues.length) return {metadata, issues};

  metadata.type = data.readUInt16LE(16);
  metadata.machineId = data.readUInt16LE(18);
  metadata.machine = metadata.machineId === 62 ? 'x86-64' : 'unsupported';
  metadata.entry = '0x' + data.readBigUInt64LE(24).toString(16);
  const offset = data.readBigUInt64LE(32);
  metadata.programHeaderOffset = offset.toString();
  metadata.headerBytes = data.readUInt16LE(52);
  metadata.programHeaderBytes = data.readUInt16LE(54);
  metadata.programHeaderCount = data.readUInt16LE(56);
  metadata.loadSegments = [];
  if (![2, 3].includes(metadata.type)) add('elf-type', 'The ELF must be an executable or a loadable shared object.');
  if (metadata.machineId !== 62) add('elf-machine', 'The console payload must target x86-64.');
  if (data.readUInt32LE(20) !== 1) add('elf-version', 'The ELF header version must be 1.');
  if (metadata.headerBytes !== 64) add('elf-header-size', 'The ELF64 header size must be 64 bytes.');
  if (metadata.programHeaderBytes !== 56) add('elf-program-header-size', 'Each ELF64 program header must be 56 bytes.');
  if (metadata.programHeaderCount === 0) add('elf-program-headers-missing', 'The executable has no program headers.');
  // BigInt bounds prevent a corrupt 64-bit offset from losing integer precision.
  const tableEnd = offset + BigInt(metadata.programHeaderBytes) * BigInt(metadata.programHeaderCount);
  if (offset < 64n || tableEnd > BigInt(data.length)) add('elf-program-header-bounds', 'The program-header table lies outside the file or overlaps the ELF header.');
  if (issues.some(item => ['elf-program-header-size', 'elf-program-headers-missing', 'elf-program-header-bounds'].includes(item.code))) return {metadata, issues};

  for (let index = 0; index < metadata.programHeaderCount; index++) {
    const start = Number(offset) + index * metadata.programHeaderBytes;
    if (data.readUInt32LE(start) !== 1) continue; // PT_LOAD
    const fileOffset = data.readBigUInt64LE(start + 8);
    const virtualAddress = data.readBigUInt64LE(start + 16);
    const fileBytes = data.readBigUInt64LE(start + 32);
    const memoryBytes = data.readBigUInt64LE(start + 40);
    metadata.loadSegments.push({index, flags: data.readUInt32LE(start + 4), fileOffset: fileOffset.toString(),
      virtualAddress: '0x' + virtualAddress.toString(16), fileBytes: fileBytes.toString(), memoryBytes: memoryBytes.toString()});
    if (fileOffset + fileBytes > BigInt(data.length)) add('elf-load-segment-bounds', 'PT_LOAD segment ' + index + ' extends beyond the file.');
    if (fileBytes > memoryBytes) add('elf-load-segment-size', 'PT_LOAD segment ' + index + ' has more file bytes than memory bytes.');
  }
  if (!metadata.loadSegments.length) add('elf-load-segments-missing', 'The executable has no PT_LOAD segments.');
  return {metadata, issues};
}

async function verifyAction(action, root = ROOT) {
  const record = {id: action.id, platform: action.platform, format: String(action.format || '').toUpperCase(),
    file: /^\/downloads\//.test(action.downloadURL || '') ? action.downloadURL : null,
    runnable: Boolean(action.run), transport: action.run ? action.run.type : null,
    expectedBytes: action.bytes == null ? null : action.bytes, expectedSha256: action.sha256 || null,
    bytes: null, sha256: null, runnableValidatorPassed: null, elf: null, passed: false, issues: []};
  function add(code, message) {
    if (!record.issues.some(item => item.code === code)) record.issues.push(issue(code, message));
  }
  let data;
  if (record.runnable) {
    try {
      data = (await readVerifiedFile(action, root)).data;
      record.runnableValidatorPassed = true;
    } catch (error) {
      record.runnableValidatorPassed = false;
      add(error.code || 'runnable-file-unavailable', 'The existing sender file validator rejected this action.');
    }
  }
  try {
    // Download-only ELFs include the bootstrap loader, which has no ordinary Run
    // transport. This also captures actual hashes when the sender rejects bytes.
    if (!data) {
      const local = localFileFor(action, root, {forRun: false});
      data = await fs.readFile(local.file);
      if (data.length !== local.bytes) add('file-changed', 'The file size changed while it was read.');
    }
    record.bytes = data.length;
    record.sha256 = digest(data);
    if (record.expectedBytes !== null && record.bytes !== record.expectedBytes) add('byte-count-mismatch', 'The file size differs from the catalogue byte count.');
    if (record.sha256 !== String(record.expectedSha256 || '').toLowerCase()) add('checksum-mismatch', 'The file SHA-256 differs from the catalogue checksum.');
    if (record.format === 'ELF') {
      const elf = validateELF(data);
      record.elf = elf.metadata;
      elf.issues.forEach(item => add(item.code, item.message));
    }
  } catch (error) {
    // Do not include filesystem exception messages, absolute paths or local data
    // in the public report. Only curated website-relative paths are recorded.
    add(error.code || 'file-unavailable', 'The curated download could not be read for static verification.');
  }
  record.passed = record.issues.length === 0;
  return record;
}

async function verifyHostPayloads({root = ROOT, actions = loadActions(root)} = {}) {
  const selected = actions.filter(action => action.run || String(action.format || '').toUpperCase() === 'ELF' && action.downloadURL);
  const files = [];
  // Read sequentially so large ELF/BIN buffers are released between files.
  for (const action of selected) files.push(await verifyAction(action, root));
  const runnable = files.filter(file => file.runnable), elves = files.filter(file => file.format === 'ELF');
  return {generatedAt: new Date().toISOString(), passed: files.every(file => file.passed),
    scope: {mode: 'Static local file verification', payloadExecution: false, consoleContact: false, networkRequests: false,
      limitations: ['Checksums and ELF structure do not establish firmware compatibility or successful console execution.',
        'BIN files are checked against their pinned checksum and size where listed; no BIN executable-format claim is made.',
        'A download-only bootstrap ELF is checked as a file and does not gain a Run transport.']},
    summary: {catalogueActions: actions.length, files: files.length, passed: files.filter(file => file.passed).length,
      failed: files.filter(file => !file.passed).length, bytes: files.reduce((total, file) => total + (file.bytes || 0), 0),
      runnableActions: runnable.length, runnableValidatorPassed: runnable.filter(file => file.runnableValidatorPassed).length,
      elfDownloads: elves.length, elfPassed: elves.filter(file => file.passed).length}, files};
}

async function main(args = process.argv.slice(2)) {
  if (args.some(value => value !== '--write') || args.length > 1) throw Error('Usage: node scripts/verify-host-payloads.cjs [--write]');
  const report = await verifyHostPayloads();
  if (args.includes('--write')) await fs.writeFile(path.join(ROOT, REPORT), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ok: report.passed, ...report.summary, ...(args.includes('--write') ? {report: REPORT} : {})}, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
  return report;
}

if (require.main === module) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
module.exports = {REPORT, validateELF, verifyAction, verifyHostPayloads, main};
