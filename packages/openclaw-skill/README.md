# Token Monitor — OpenClaw Skill

Reports token usage events from OpenClaw to the Token Monitor desktop app.

## Setup

1. Place this skill in your OpenClaw skills directory
2. Make sure Token Monitor desktop app is running
3. The skill will automatically POST usage data to `127.0.0.1:7878/api/usage` after each AI response

## Configuration

| Key | Type | Default | Description |
| --- | ---- | ------- | ----------- |
| `desktop_port` | number | 7878 | Port where Token Monitor desktop is listening |

## How it works

After each AI response processed by OpenClaw, this skill extracts token counts and cost data, then sends it as a JSON payload to the Token Monitor proxy server over localhost. If the desktop app is not running, the request silently fails.
