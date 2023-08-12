const { db, knex_inited } = require("./realdb.js");

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

const db2 = {
	get: async function (item) {
		return this.db[item];
	},
	set: async function (item, content) {
		while (fs.existsSync(__dirname + "/db.lok")) {
			await setTimeoutAsync(500);
		}
		fs.writeFileSync(__dirname + "/db.lok", "The database lock file!\r\nIf you got permanently locked:\r\nDelete this file.\r\nCause of lock: db.set");
		fs.chmodSync(__dirname + "/db.lok", 448);
		var db = JSON.parse(JSON.stringify(this.db));
		db[item] = content;
		this.db = db;
		fs.rmSync(__dirname + "/db.lok", {
			force: true
		});
	},
	delete: async function (item) {
		while (fs.existsSync(__dirname + "/db.lok")) {
			await setTimeoutAsync(500);
		}
		fs.writeFileSync(__dirname + "/db.lok", "The database lock file!\r\nIf you got permanently locked:\r\nDelete this file.\r\nCause of lock: db.delete");
		fs.chmodSync(__dirname + "/db.lok", 448);
		var db = JSON.parse(JSON.stringify(this.db));
		delete db[item];
		this.db = db;
		fs.rmSync(__dirname + "/db.lok", {
			force: true
		});
	},
	list: async function () {
		return Object.keys(this.db)
	},
	db: null,
	get db() {
		return JSON.parse(require("fs").readFileSync(__dirname + "/db.json"));
	},
	set db(val) {
		require("fs").writeFileSync(__dirname + "/db.json", JSON.stringify(val, null, "\t"));
	}
};

(async function Main() {
    console.log("Creating schemas...");
    await createSchema("users", usersFn);
    console.log("Created schema users");
    await createSchema("vms", vmsFn);
    console.log("Created schema vms");
	console.log("Migrating users...");
    let rawdb = db2.db;
    for (let user in rawdb) {
        console.log("Migrating", user);
        await db.set(user, rawdb[user]);
    }
    console.log("Process complete!");
})();