#!/usr/bin/env node
import fs from 'node:fs';

console.log("Applying Node patch to unlock LAN IP logins...");

const targets = [
  "/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/index.js",
  "/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/types/protocol.js"
];

for (const file of targets) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // 放行所有端口格式
    content = content.replace(
      /\/\^http:\\\/\\\/\(\?:localhost\|127\\\.0\\\.0\\\.1\|\\\[::1\\\]\):\(\[0-9\]\+\)\\\/\?\$/g,
      '/^http:\\/\\/(?:[a-zA-Z0-9.-]+|\\[[a-fA-F0-9:]+\\]):([0-9]+)\\/?$'
    );
    // 放行 hostname 检查
    content = content.replace(
      "!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)",
      "false"
    );
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Successfully patched: ${file}`);
  }
}
