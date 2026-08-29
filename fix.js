const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
};

const files = walk('./client/src').filter(f => f.endsWith('.jsx') || f.endsWith('.js'));
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("'" + "${import.meta.env.VITE_SERVER_URL}")) {
    content = content.replace(/'\$\{import\.meta\.env\.VITE_SERVER_URL\}(.*?)'/g, '`$${import.meta.env.VITE_SERVER_URL}$1`');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
});
