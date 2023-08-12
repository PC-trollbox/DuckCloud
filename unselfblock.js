const objection = require("objection");
const knex = require("knex");
const readline = require("readline/promises");
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
const { User, VMEntry, objectionModel, knex, objection, db, knex_inited } = require("./realdb.js");

async function createSchema(name, tableFn) {
    if (await knex_inited.schema.hasTable(name)) return
    await knex_inited.schema.createTable(name, tableFn);
}

function usersFn(table) {
    table.increments("id").primary();
    table.string("name");
    table.string("password");
    table.string("token");
    table.boolean("_isPRO");
    table.boolean("_disableSharing");
    table.string("_technicians");
    table.string("linkedTo");
    table.string("recoveryKey");
    table.boolean("_cannotPRO");
    table.boolean("_blockEnumVM");
    table.boolean("_blockLogin");
    table.boolean("_block_ul");
    table.boolean("_isCertifiedTechnician");
    table.string("_procodes");
}

function vmsFn(table) {
    table.string("id").primary();
    table.string("name");
    table.boolean("_clickbased");
    table.string("_whitelist");
    table.integer("user_id").references("id").inTable("users");
}

(async function Main() {
    console.log("Creating schemas...");
    await createSchema("users", usersFn);
    console.log("Created schema users");
    await createSchema("vms", vmsFn);
    console.log("Created schema vms");
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