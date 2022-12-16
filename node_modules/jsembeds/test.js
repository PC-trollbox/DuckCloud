var embed = require("./index.js");
console.log(embed.embed("This is original string, and <embed>\"this is JS\"<closeEmbed> that can cause <embed>throw new Error(\"errors\")<closeEmbed>"))