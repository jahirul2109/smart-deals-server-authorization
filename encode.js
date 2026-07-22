const fs = require('fs');
const key = fs.readFileSync('./smart-deals-client-v1.json');
const base64 = Buffer.from(key).toString('base64');
console.log(base64)