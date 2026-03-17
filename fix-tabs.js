const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.mdx')) results.push(file);
        }
    });
    return results;
}

const files = walk('c:/Users/aryan/Desktop/Projects/Agni-docs/api-reference');

let count = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // Replace <RequestExample> Tabs
    content = content.replace(/<RequestExample>[\s\S]*?<Tabs>([\s\S]*?)<\/Tabs>[\s\S]*?<\/RequestExample>/g, (match, p1) => {
        let replacement = '<RequestExample>\n';
        const tabRegex = /<Tab title="([^"]+)">\s*```([a-z]+)\n([\s\S]*?)```\s*<\/Tab>/g;
        let tabMatch;
        while ((tabMatch = tabRegex.exec(p1)) !== null) {
            const title = tabMatch[1];
            const lang = tabMatch[2];
            let code = tabMatch[3].trimEnd();
            // remove trailing newlines and spaces, but keep formatting
            // In Mintlify, we need to use: ```language title 
            replacement += `\`\`\`${lang} ${title}\n${code}\n\`\`\`\n`;
        }
        replacement += '</RequestExample>';
        modified = true;
        return replacement;
    });

    // Replace <ResponseExample> Tabs
    content = content.replace(/<ResponseExample>[\s\S]*?<Tabs>([\s\S]*?)<\/Tabs>[\s\S]*?<\/ResponseExample>/g, (match, p1) => {
        let replacement = '<ResponseExample>\n';
        const tabRegex = /<Tab title="([^"]+)">\s*```([a-zA-Z]+)\n([\s\S]*?)```\s*<\/Tab>/g;
        let tabMatch;
        while ((tabMatch = tabRegex.exec(p1)) !== null) {
            const title = tabMatch[1];
            const lang = tabMatch[2];
            let code = tabMatch[3].trimEnd();
            replacement += `\`\`\`${lang} ${title}\n${code}\n\`\`\`\n`;
        }
        replacement += '</ResponseExample>';
        modified = true;
        return replacement;
    });

    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
    }
});

console.log("Fixed " + count + " files.");
