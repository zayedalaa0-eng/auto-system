const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
      callback(path.join(dirPath));
    }
  });
}

walkDir('c:/Users/a0zay/OneDrive/Desktop/auto-system/web/src', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  content = content.replace(/المعلم/g, "لمعلم");
  content = content.replace(/الفورثنك/g, "فورثنج");
  content = content.replace(/الفورثنج/g, "فورثنج");
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
});
