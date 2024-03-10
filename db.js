const fs = require("fs");

function db(table) {
    return {
        get: async function (item) {
            return (table ? this.db[table] : this.db)[item];
        },
        set: async function (item, content) {
            while (fs.existsSync(__dirname + "/db.lok")) {
                await setTimeoutAsync(500);
            }
            fs.writeFileSync(__dirname + "/db.lok", "The database lock file!\r\nIf you got permanently locked:\r\nDelete this file.\r\nCause of lock: db.set");
            fs.chmodSync(__dirname + "/db.lok", 448);
            let db = JSON.parse(JSON.stringify(this.db));
            (table ? db[table] : db)[item] = content;
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
            let db = JSON.parse(JSON.stringify(this.db));
            delete (table ? db[table] : db)[item];
            this.db = db;
            fs.rmSync(__dirname + "/db.lok", {
                force: true
            });
        },
        list: async function () {
            return Object.keys(table ? this.db[table] : this.db);
        },
        db: null,
        get db() {
            return JSON.parse(require("fs").readFileSync(__dirname + "/db.json"));
        },
        set db(val) {
            require("fs").writeFileSync(__dirname + "/db.json", JSON.stringify(val, null, "\t"));
        }
    }
};

module.exports = db;