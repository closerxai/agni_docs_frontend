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
    let original = content;
    
    // Add empty lines inside RequestExample
    content = content.replace(/<RequestExample>([\s\S]*?)<\/RequestExample>/g, (match, p1) => {
        let internal = p1.trim();
        internal = internal.replace(/```\n+```/g, '```\n\n```');
        return `<RequestExample>\n\n${internal}\n\n</RequestExample>`;
    });

    content = content.replace(/<ResponseExample>([\s\S]*?)<\/ResponseExample>/g, (match, p1) => {
        let internal = p1.trim();
        internal = internal.replace(/```\n+```/g, '```\n\n```');
        return `<ResponseExample>\n\n${internal}\n\n</ResponseExample>`;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
    }
});

console.log("Fixed newlines in " + count + " files.");
