#!/usr/bin/env node
import { execSync } from 'node:child_process';

const repo = process.env.GITHUB_REPOSITORY;
const workflow = process.env.GITHUB_WORKFLOW ?? 'harness';
const runId = process.env.GITHUB_RUN_ID;
const sha = process.env.GITHUB_SHA?.slice(0, 7) ?? 'unknown';
const ref = process.env.GITHUB_REF ?? 'unknown';
const runUrl = `https://github.com/${repo}/actions/runs/${runId}`;
const title = `Harness regression: ${workflow} failed (${sha})`;
const body = `## Harness regression\n- workflow: ${workflow}\n- run: ${runUrl}\n- branch: ${ref}\n- commit: ${sha}\n\nView logs: ${runUrl}`;

function run(cmd, input = '') {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], input }).trim();
}

let issueNumber = '';
try {
  issueNumber = run("gh issue list --label harness-alert --state open --json number --jq '.[0].number' || true");
  if (!issueNumber) issueNumber = '';
} catch (error) {
  issueNumber = '';
}

if (issueNumber) {
  run(`gh issue comment ${issueNumber}`, body);
} else {
  run(`gh issue create --title "${title.replace(/"/g, '')}" --label harness-alert --label type:ci-alert`, body);
}
