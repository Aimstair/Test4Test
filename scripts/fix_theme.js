const fs = require('fs');
const path = require('path');

const files = [
  'src/components/EmptyState.tsx',
  'src/components/AlertProvider.tsx',
  'src/app/studio/new.tsx',
  'src/app/studio/[id].tsx',
  'src/app/setup/[id].tsx',
  'src/app/pricing.tsx',
  'src/app/onboarding.tsx',
  'src/app/how-it-works.tsx',
  'src/app/catalog/[id].tsx',
  'src/app/admin/tickets.tsx',
  'src/app/(tabs)/verify.tsx',
  'src/app/(tabs)/studio.tsx',
  'src/app/(tabs)/dashboard.tsx'
];

for (const relPath of files) {
  const file = path.join(process.cwd(), relPath);
  if (!fs.existsSync(file)) continue;

  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/color:\s*colors\.background\s*,/g, "color: '#FFFFFF',");
  content = content.replace(/backgroundColor:\s*colors\.text\s*,/g, "backgroundColor: colors.primary,");

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
}
