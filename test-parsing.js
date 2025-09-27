const fs = require('fs');

const content = fs.readFileSync('test-config-v3.yaml', 'utf8');
console.log('First 500 chars of config:');
console.log(content.substring(0, 500));
console.log('\n---\n');

// Test the regex
const settingsMatch = content.match(/settings:\s*\n(.*?)(?=\n\w|$)/s);
if (settingsMatch) {
  console.log('Settings match found');
  const settingsBlock = settingsMatch[1];
  console.log('Settings block:');
  console.log(settingsBlock);
  console.log('\n---\n');

  const settingsLines = settingsBlock.split('\n').filter(line => line.trim());
  console.log('Settings lines:');
  settingsLines.forEach((line, i) => console.log(`${i}: '${line}'`));

  // Test parsing logic
  let currentSetting = null;
  const config = { settings: [] };

  for (const line of settingsLines) {
      if (line.startsWith('  - name:')) {
          if (currentSetting) {
              config.settings.push(currentSetting);
          }
          const name = line.match(/name:\s*"([^"]+)"/)?.[1] || '';
          currentSetting = { name };
          console.log(`\nStarted parsing setting: ${name}`);
      } else if (currentSetting && line.includes(':')) {
          const [key, ...valueParts] = line.trim().split(':');
          const value = valueParts.join(':').trim();
          currentSetting[key.trim()] = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
          console.log(`  Added key-value: ${key.trim()} = ${currentSetting[key.trim()]}`);
      } else if (currentSetting && currentSetting.name === 'continueignore' && line.trim() && !line.includes(':') && !line.startsWith('  -')) {
          // Handle direct values for continueignore (patterns without keys)
          const pattern = line.trim();
          if (!currentSetting.patterns) {
              currentSetting.patterns = [];
          }
          currentSetting.patterns.push(pattern);
          console.log(`  Added pattern: ${pattern}`);
      }
  }

  if (currentSetting) {
      config.settings.push(currentSetting);
  }

  console.log('\n---\nFinal parsed settings:');
  console.log(JSON.stringify(config.settings, null, 2));
} else {
  console.log('No settings match found');
}
