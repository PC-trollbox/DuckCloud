const readline = require("readline/promises");
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
const { User, VMEntry, objectionModel, knex, objection, db, knex_inited, onready } = require("./realdb.js");

(async function Main() {
    await onready;
	console.log("The minimal shell for recovery is ready.");
	console.log("Use JavaScript expressions to interact with the database. Everything will be synchronized as soon as possible, but please wait a few seconds before exiting.");
	console.log("Then use `process.exit(0)` to leave this shell.");
	while (true) {
		let cmd = await rl.question("# ");
		try {
			console.log(eval(cmd));
		} catch (e) {
			console.error(e);
		}
	}
})();