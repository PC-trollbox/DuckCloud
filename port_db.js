const fs = require("fs");
async function setTimeoutAsync(ms) {
    return new Promise(function (a) {
        setTimeout(function () {
            a(ms);
        }, ms);
    });
}

(async function () {
    while (fs.existsSync(__dirname + "/db.lok")) {
        await setTimeoutAsync(500);
    }
    fs.writeFileSync(__dirname + "/db.lok", "The database lock file!\r\nIf you got permanently locked:\r\nDelete this file.\r\nCause of lock: Database upgrade");
    fs.chmodSync(__dirname + "/db.lok", 448);
    let db = JSON.parse(fs.readFileSync(__dirname + "/db.json"));
    db = {users: db, tokens: {}, virtuals: {}};
    for (let user in db.users) {
        delete db.users[user].technicians;
        delete db.users[user].isCertifiedTechnician;
        delete db.users[user].linkedTo;
        db.tokens[db.users[user].token] = user;
        for (let virtual in db.users[user].virtuals) {
            db.virtuals[db.users[user].virtuals[virtual].id] = { username: user, vmname: virtual };
        }
    }
    fs.writeFileSync(__dirname + "/db.json", JSON.stringify(db, null, "\t"));
    fs.rmSync(__dirname + "/db.lok", {
        force: true
    });
})();