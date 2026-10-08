const fs = require('node:fs');
const path = require('node:path');

const articlesDirectory = path.join(__dirname, '..', 'articles');
const articlePaths = fs.readdirSync(articlesDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => entry.name)
    .sort();

fs.writeFileSync(
    path.join(articlesDirectory, 'index.json'),
    `${JSON.stringify(articlePaths, null, 2)}\n`
);

console.log(`Generated articles/index.json with ${articlePaths.length} article(s).`);
