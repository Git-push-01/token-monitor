import path from 'path';
import os from 'os';
import fs from 'fs';
import readline from 'readline';
import { watch } from 'chokidar';
import { v4 as uuid } from 'uuid';
import { calculateCost } from '@token-monitor/shared';
import type { UsageEventV1 } from '@token-monitor/shared';
import type { ProviderAdapter } from '../engine';
import type { DataEngine } from '../engine';

const CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects');

interface ClaudeCodeMessage {
  type: string;
  message?: {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    stop_reason?: string;
  };
  timestamp?: string;
}

export class ClaudeCodeAdapter implements ProviderAdapter {
  readonly type = 'claude_code' as const;
  private watcher: ReturnType<typeof watch> | null = null;
  private filePositions = new Map<string, number>(); // track read position per file
  private engine: DataEngine;
  private providerId: string;

  constructor(engine: DataEngine, providerId: string) {
    this.engine = engine;
    this.providerId = providerId;
  }

  async start() {
    if (!fs.existsSync(CLAUDE_DIR)) {
      console.log('[ClaudeCode] Directory not found:', CLAUDE_DIR);
      return;
    }

    console.log('[ClaudeCode] Watching:', CLAUDE_DIR);

    this.watcher = watch(CLAUDE_DIR, {
      persistent: true,
      ignoreInitial: false,
      depth: 5,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    this.watcher.on('add', (filepath) => {
      if (filepath.endsWith('.jsonl')) {
        this.parseFile(filepath, false);
      }
    });

    this.watcher.on('change', (filepath) => {
      if (filepath.endsWith('.jsonl')) {
        this.parseNewLines(filepath);
      }
    });
  }

  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.filePositions.clear();
  }

  async testConnection(): Promise<{ valid: boolean; info?: string }> {
    if (!fs.existsSync(CLAUDE_DIR)) {
      return { valid: false, info: `Claude Code directory not found at ${CLAUDE_DIR}` };
    }

    // Count projects and sessions
    let projectCount = 0;
    let sessionCount = 0;
    try {
      const entries = fs.readdirSync(CLAUDE_DIR);
      for (const entry of entries) {
        const projectPath = path.join(CLAUDE_DIR, entry);
        if (fs.statSync(projectPath).isDirectory()) {
          projectCount++;
          const sessionsDir = path.join(projectPath, 'sessions');
          if (fs.existsSync(sessionsDir)) {
            const sessions = fs.readdirSync(sessionsDir);
            sessionCount += sessions.length;
          }
        }
      }
    } catch {
      // Ignore read errors
    }

    return {
      valid: true,
      info: `Found ${projectCount} projects with ${sessionCount} sessions`,
    };
  }

  private async parseFile(filepath: string, onlyNew: boolean) {
    const startPosition = onlyNew ? (this.filePositions.get(filepath) || 0) : 0;
    let currentPosition = 0;
    let lineCount = 0;

    const stream = fs.createReadStream(filepath, {
      start: startPosition,
      encoding: 'utf-8',
    });

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      currentPosition += Buffer.byteLength(line, 'utf-8') + 1; // +1 for newline
      if (!line.trim()) continue;

      try {
        const msg: ClaudeCodeMessage = JSON.parse(line);
        if (msg.type === 'assistant' && msg.message?.usage) {
          this.processUsage(msg, filepath);
          lineCount++;
        }
      } catch {
        // Skip malformed lines
      }
    }

    this.filePositions.set(filepath, startPosition + currentPosition);

    if (lineCount > 0) {
      console.log(`[ClaudeCode] Processed ${lineCount} usage records from ${path.basename(filepath)}`);
    }
  }

  private async parseNewLines(filepath: string) {
    await this.parseFile(filepath, true);
  }

  private processUsage(msg: ClaudeCodeMessage, filepath: string) {
    const usage = msg.message!.usage!;
    const model = msg.message!.model || 'unknown';

    // Extract session/project info from file path
    // Path format: ~/.claude/projects/{project-hash}/sessions/{session-id}/*.jsonl
    const parts = filepath.split(path.sep);
    const projectIdx = parts.indexOf('projects');
    const sessionIdx = parts.indexOf('sessions');
    const projectHash = projectIdx >= 0 ? parts[projectIdx + 1] : 'unknown';
    const sessionId = sessionIdx >= 0 ? parts[sessionIdx + 1] : 'unknown';

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens || 0;

    const costUsd = calculateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens) ?? undefined;

    const event: UsageEventV1 = {
      id: uuid(),
      ts: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
      provider: 'claude_code',
      providerId: this.providerId,
      instanceId: `claude-code-${projectHash}`,
      sessionId: sessionId,
      requestId: msg.message?.id,
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd,
      quality: 'exact',
      meta: {
        projectHash,
        stopReason: msg.message?.stop_reason,
        source: 'jsonl',
      },
    };

    this.engine.ingestEvent(event);
  }
}
