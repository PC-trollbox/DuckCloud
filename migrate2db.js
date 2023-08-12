const { db, onready } = require("./realdb.js");

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
    await onready;
	console.log("Migrating users...");
    let rawdb = db2.db;
    for (let user in rawdb) {
        console.log("Migrating", user);
        await db.set(user, rawdb[user]);
    }
    console.log("Process complete!");
})();