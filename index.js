//Start up the modules
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const he = require("he");
const fs = require("fs");
const crypto = require("crypto");
const dockerode = require('dockerode');
const engine = require("jsembedtemplateengine");
const docker = new dockerode();
const app = express();
const http = require("http").Server(app);
const net = require("net");
const admin_email = "admin@example.com"; //<- Replace this with your actual email address
const io = require("socket.io")(http, {
	allowEIO3: true,
	cookie: true
});

function setTimeoutAsync(ms) {
	return new Promise(function (a) {
		setTimeout(function () {
			a(ms);
		}, ms);
	});
}
const cookie = require("cookie");
const db = {
	get: async function (item) {
		return this.db.users[item];
	},
	set: async function (item, content) {
		while (fs.existsSync(__dirname + "/db.lok")) {
			await setTimeoutAsync(500);
		}
		fs.writeFileSync(__dirname + "/db.lok", "The database lock file!\r\nIf you got permanently locked:\r\nDelete this file.\r\nCause of lock: db.set");
		fs.chmodSync(__dirname + "/db.lok", 448);
		var db = JSON.parse(JSON.stringify(this.db));
		db.users[item] = content;
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
		delete db.users[item];
		this.db = db;
		fs.rmSync(__dirname + "/db.lok", {
			force: true
		});
	},
	list: async function () {
		return Object.keys(this.db.users);
	},
	db: null,
	get db() {
		return JSON.parse(require("fs").readFileSync(__dirname + "/db.json"));
	},
	set db(val) {
		require("fs").writeFileSync(__dirname + "/db.json", JSON.stringify(val, null, "\t"));
	}
};
const db_tokens = {
	get: async function (item) {
		return this.db.tokens[item];
	},
	set: async function (item, content) {
		while (fs.existsSync(__dirname + "/db.lok")) {
			await setTimeoutAsync(500);
		}
		fs.writeFileSync(__dirname + "/db.lok", "The database lock file!\r\nIf you got permanently locked:\r\nDelete this file.\r\nCause of lock: db.set");
		fs.chmodSync(__dirname + "/db.lok", 448);
		var db = JSON.parse(JSON.stringify(this.db));
		db.tokens[item] = content;
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
		delete db.tokens[item];
		this.db = db;
		fs.rmSync(__dirname + "/db.lok", {
			force: true
		});
	},
	list: async function () {
		return Object.keys(this.db.tokens)
	},
	db: null,
	get db() {
		return JSON.parse(require("fs").readFileSync(__dirname + "/db.json"));
	},
	set db(val) {
		require("fs").writeFileSync(__dirname + "/db.json", JSON.stringify(val, null, "\t"));
	}
};
const db_virtuals = {
	get: async function (item) {
		return this.db.virtuals[item];
	},
	set: async function (item, content) {
		while (fs.existsSync(__dirname + "/db.lok")) {
			await setTimeoutAsync(500);
		}
		fs.writeFileSync(__dirname + "/db.lok", "The database lock file!\r\nIf you got permanently locked:\r\nDelete this file.\r\nCause of lock: db.set");
		fs.chmodSync(__dirname + "/db.lok", 448);
		var db = JSON.parse(JSON.stringify(this.db));
		db.virtuals[item] = content;
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
		delete db.virtuals[item];
		this.db = db;
		fs.rmSync(__dirname + "/db.lok", {
			force: true
		});
	},
	list: async function () {
		return Object.keys(this.db.virtuals)
	},
	db: null,
	get db() {
		return JSON.parse(require("fs").readFileSync(__dirname + "/db.json"));
	},
	set db(val) {
		require("fs").writeFileSync(__dirname + "/db.json", JSON.stringify(val, null, "\t"));
	}
};
const promisifyStream = stream => new Promise((resolve, reject) => {
	let myData = Buffer.from("");
	stream.on('data', data => myData = Buffer.concat([myData, data]))
	stream.on('end', () => resolve(myData))
	stream.on('error', reject)
});
let all_features = {};
engine(app, {
	embedOpen: "<nodejs-embed>",
	embedClose: "</nodejs-embed>"
});
app.set('views', '.')
app.set('view engine', 'jsembeds');

//Assign some middleware
app.use(bodyParser.urlencoded({
	extended: true,
	limit: "128mb"
}));
app.use(bodyParser.json({
	limit: "128mb"
}));
app.use(cookieParser());

emitter = {
	workspaces: {},
	createWorkspace: function (vm) {
		return this.workspaces[vm] = {
			emit: function (e, ...mit) {
				if (e == "deletion") throw new Error("impossible");
				if (!e) throw new Error("get me some events");
				if (typeof e !== "string") throw new Error("omg this is really impossible to emit " + String(typeof e));
				if (this.callbacks.hasOwnProperty(e)) {
					for (let callback of this.callbacks[e]) {
						callback(...mit)
					}
				}
			},
			on: function (e, mit) {
				if (!e) throw new Error("get me some events");
				if (typeof e !== "string") throw new Error("omg this is really impossible to emit " + String(typeof e));
				if (typeof mit !== "function") throw new Error("omg this is really impossible to catch using " + String(typeof mit));
				if (!this.callbacks.hasOwnProperty(e)) this.callbacks[e] = [];
				this.callbacks[e].push(mit);
			},
			once: function (e, mit) {
				if (!e) throw new Error("get me some events");
				if (typeof e !== "string") throw new Error("omg this is really impossible to emit " + String(typeof e));
				if (typeof mit !== "function") throw new Error("omg this is really impossible to catch using " + String(typeof mit));
				if (!this.callbacks.hasOwnProperty(e)) this.callbacks[e] = [];
				let regNum = this.callbacks[e].push(function (e, ...mit2) {
					this.callbacks[e].splice(regNum, 1);
					mit(e, ...mit2);
				});
			},
			callbacks: {}
		}
	},
	goToWorkspace: function (vm) {
		return this.workspaces[vm] || this.createWorkspace(vm);
	},
	removeWorkspace: function (vm) {
		if (!this.workspaces[vm]) this.workspaces[vm] = {
			callbacks: {}
		};
		if (this.workspaces[vm].callbacks.hasOwnProperty("deletion")) {
			for (let callback of this.workspaces[vm].callbacks["deletion"]) {
				callback("");
			}
		}
		delete this.workspaces[vm];
	}
}
let ips = {};

//SHA-256 generator
function SHA256(input) {
	return crypto.createHash('sha256').update(input).digest('base64');
}

//Token generator
function genToken(long = 16) {
	if (long % 2 != 0) throw new Error("invalid token length");
	return crypto.randomBytes(long / 2).toString("hex").split("", long).join("");
}

//Get user by token
async function getUserByToken(token) {
	if (fs.existsSync(__dirname + "/duckcloud.blok")) return null;
	let tokenEntry = await db_tokens.get(token);
	if (!tokenEntry) return null;
	let obj = await db.get(tokenEntry);
	if (!obj) return null;
	if (obj.blockLogin) return null;
	if (obj.token == token) return { object: obj, username: tokenEntry, token: token };
	return null;
}

//Automatic session extension and more
app.use(function (req, res, next) {
	if (req.cookies.token) {
		res.cookie("token", req.cookies.token, {
			maxAge: 30 * 24 * 60 * 60 * 1000
		});
	}
	if (fs.existsSync(__dirname + "/duckcloud.blok") && req.originalUrl != "/regular.css") {
		let read = fs.readFileSync(__dirname + "/duckcloud.blok").toString();
		return res.status(503).render(__dirname + "/duckcloud_blocked.jsembeds", {
			shutdown_info: (read ? ("<hr>There's some info that the administrator left:<br><pre>" + read + "</pre>") : "")
		});
	}
	let ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "0.0.0.0";
	if (ips.hasOwnProperty(ip)) {
		if (ips[ip].includes(new URL(req.headers.origin || "http://non-existing.domain.loc").host)) {
			res.set("Access-Control-Allow-Origin", req.headers.origin || "*");
			res.set("Access-Control-Allow-Credentials", "true");
			res.set("Vary", "Origin");
		}
	}
	next();
});

//And... yep. goodluck! :)
app.get('/', async (req, res) => {
	if (req.cookies.token) return res.redirect("/main");
	res.render(__dirname + "/index.jsembeds");
});

app.get('/regular.css', async (req, res) => {
	res.sendFile(__dirname + "/regular.css");
});

app.get("/register", async function (req, res) {
	if (req.cookies.token) return res.redirect("/main");
	res.render(__dirname + "/register.jsembeds");
});

app.post("/register", async function (req, res) {
	if (req.cookies.token) return res.redirect("/main");
	if (!req.body.username) return res.redirect("/register");
	if (!req.body.password) return res.redirect("/register");
	if ((await db.list()).includes(req.body.username)) {
		return res.redirect("/register");
	}
	let token = genToken(64);
	await db.set(req.body.username, {
		password: SHA256(req.body.password),
		token: token,
		virtuals: {},
		isPRO: false,
		disableSharing: true
	});
	await db_tokens.set(token, req.body.username);
	return res.redirect("/");
});

app.post("/login", async function (req, res) {
	if (req.cookies.token) return res.redirect("/main");
	if (!req.body.username) return res.redirect("/");
	if (!req.body.password) return res.redirect("/");
	if (!((await db.list()).includes(req.body.username))) {
		return res.redirect("/");
	}
	let user = await db.get(req.body.username);
	if (SHA256(req.body.password) == user.password) {
		if (user.blockLogin) return res.status(403).render(__dirname + "/redirector.jsembeds", {
			target: "/",
			msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.<br>Help information: To unblock your account, contact the System Administrator (can be found <a href=\"/contact\">here</a>) and tell them your username and your recovery key. Tell them to unblock logon (and possibly other functions). If you don't have a recovery key, attempt to remember any information on your account that you have stored in VMs.",
			disableRedirect: true
		});
		res.cookie("token", user.token, {
			maxAge: 30 * 24 * 60 * 60 * 1000
		});
	} else {
		return res.redirect("/");
	}
	res.redirect("/main");
});

app.get("/main", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	let dockers = "";
	if (user.object.virtuals && !user.object.blockEnumVM) {
		for (let vm in user.object.virtuals) {
			let top = 0;
			let container = docker.getContainer(user.object.virtuals[vm].id);
			let state = await container.inspect();
			state = state.State.Running ? "online" : "offline";
			top = (Object.keys(user.object.virtuals).indexOf(vm)) * 10;
			dockers = dockers + "<a class=\"object vmsetlink\" href=\"/settings/" + Object.keys(user.object.virtuals).indexOf(vm) + "\" style=\"position: relative; top: " + top + "px;\"><b>" + he.encode(vm) + " </b><span class=\"" + state + "-icon\"></span><label class=\"arrow manage-vm\">→</label></a>";
		}
	}
	res.render(__dirname + "/template.jsembeds", {
		username: he.encode(user.username),
		dockers: dockers
	});
});
app.get("/listContainer", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	let dockers = [];
	if (user.object.virtuals && !user.object.blockEnumVM) {
		for (let vm in user.object.virtuals) {
			let container = docker.getContainer(user.object.virtuals[vm].id);
			let state = await container.inspect();
			state = state.State.Running ? "online" : "offline";
			dockers.push({
				vmname: vm,
				vmname_encoded: he.encode(vm),
				status: state
			});
		}
	}
	return res.send(dockers);
});


app.get("/settings/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	let container = docker.getContainer(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
	let state = await container.inspect();
	res.render(__dirname + "/template_2.jsembeds", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)]),
		switch: state.State.Running ? "Turn off" : "Turn on",
		switc_hide_force: state.State.Running ? "" : "hidden"
	});
});

app.get("/burn/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	let exclude_name = Object.keys(user.object.virtuals)[Number(req.params.vm)];
	let newList = {};
	let container = docker.getContainer(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
	let state = await container.inspect();
	let wasAlrRem = false;
	await db_virtuals.delete(user.object.virtuals[exclude_name].id);
	if (state.State.Running) {
		if (all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id]) {
			if (!all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id].ats) {
				all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id] = {
					ats: true
				};
				wasAlrRem = true;
				emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
 				for (let vm in user.object.virtuals) {
 					if (vm == exclude_name) continue;
					newList[vm] = user.object.virtuals[vm];
				}
				user.object.virtuals = newList;
				await db.set(user.username, user.object);
				try {
					await container.stop({
						t: 0
					});
				} catch {}
			} else {
				return res.redirect("/settings/" + req.params.vm);
			}
		} else {
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id] = {
				ats: true
			};
			wasAlrRem = true;
			emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
			for (let vm in user.object.virtuals) {
				if (vm == exclude_name) continue;
				newList[vm] = user.object.virtuals[vm];
			}
			user.object.virtuals = newList;
			await db.set(user.username, user.object);
			try {
				await container.stop();
			} catch {}
		}
	}
	if (!wasAlrRem) {
		for (let vm in user.object.virtuals) {
			if (vm == exclude_name) continue;
			newList[vm] = user.object.virtuals[vm];
		}
		user.object.virtuals = newList;
		await db.set(user.username, user.object);
	}
	await container.remove();
	res.redirect("/main");
});

app.get("/shutoff/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	let container = docker.getContainer(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
	let state = await container.inspect();
	if (all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id] && state.State.Running) {
		if (all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id].ats) {
			return res.redirect("/settings/" + req.params.vm);
		}
	}
	if (state.State.Running) {
		all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id] = {
			ats: true
		};
		emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
		try {
			await container.stop(req.query.force == "1" ? {
				t: 0
			} : undefined);
		} catch {}
	}
	if (!state.State.Running) {
		try {
			let d = emitter.goToWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
			let attach = await container.attach({
				stream: true,
				stdin: true,
				stdout: true,
				stderr: true
			});
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id] = {
				shell: Buffer.from("Welcome to your DuckCloud VM!\r\n"),
				ats: false
			};
			let our_vm = all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id];
			our_vm.started_shell = attach;
			our_vm.started_shell.on("data", function(a) {
				if ((our_vm.shell.length + a.length) < require("buffer").constants.MAX_STRING_LENGTH) {
					our_vm.shell = Buffer.concat([our_vm.shell, a]);
					d.emit("data", a);
					if (our_vm.shell.toString().includes("\x1b[H\x1b[2J")) {
						our_vm.shell = Buffer.from(our_vm.shell.toString().split("\x1b[H\x1b[2J")[our_vm.shell.toString().split("\x1b[H\x1b[2J").length - 1]);
					}
					all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id] = our_vm;
				} else {
					if (a.length < require("buffer").constants.MAX_STRING_LENGTH) {
						our_vm.shell = Buffer.concat([Buffer.from("Required cleaning of shell by Node.JS limits (e7).\r\n"), a]);
					}
				}
			});
			our_vm.started_shell.on("end", async function () {
				our_vm.ats = true;
				emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
				try {
					await container.stop();
				} catch {}
				all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id] = {
					ats: true
				};
				our_vm = {};
			});
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id] = our_vm;
			await container.start();
		} catch {
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id] = {
				ats: true
			};
			state = await container.inspect();
			if (state.State.Running) {
				emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
				try {
					await container.stop();
				} catch {}
			}
			return res.status(500).render(__dirname + "/failed_to_start.jsembeds", {
				username: he.encode(user.username)
			});
		}
	}
	res.redirect("/settings/" + req.params.vm);
});

app.get("/chown/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	res.render(__dirname + "/chown.jsembeds", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)])
	});
});

app.post("/chown/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	let our_vm = Object.keys(user.object.virtuals)[Number(req.params.vm)];
	if (req.body.username == user.username) return res.redirect("/chown/" + req.params.vm); //do not change the VM ownership
	let newOwner = await db.get(req.body.username);
	if (!newOwner) return res.redirect("/chown/" + req.params.vm);
	if ((!newOwner.isPRO && Object.keys(newOwner.virtuals).length) || newOwner.disableSharing) {
		return res.render(__dirname + "/target_not_pro_yet.jsembeds", {
			username: he.encode(user.username),
			target: he.encode(req.body.username),
			vm_count: req.params.vm,
			vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)])
		});
	}
	while (Object.keys(newOwner.virtuals).includes(our_vm)) our_vm = our_vm + " (FROM " + user.username + ")";
	newOwner.virtuals[our_vm] = user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]];
	delete user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]];
	await db_virtuals.set(newOwner.virtuals[our_vm].id, {
		username: req.body.username,
		vmname: our_vm
	});
	await db.set(user.username, user.object);
	await db.set(req.body.username, newOwner);
	res.redirect("/main");
});

app.get("/ren/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	res.render(__dirname + "/rename.jsembeds", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)])
	});
});

app.post("/ren/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	let our_vm = Object.keys(user.object.virtuals)[Number(req.params.vm)];
	while (Object.keys(user.object.virtuals).includes(our_vm)) our_vm = our_vm + " (1)";
	let virtuals2 = {};
	for (let virtual in user.object.virtuals) {
		if (Object.keys(user.object.virtuals).indexOf(virtual) == req.params.vm) {
			virtuals2[String(req.body.vmname)] = user.object.virtuals[virtual];
		} else {
			virtuals2[virtual] = user.object.virtuals[virtual];
		}
	}
	user.object.virtuals = virtuals2;
	await db_virtuals.set(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id, {
		username: user.username,
		vmname: req.body.vmname
	});
	await db.set(user.username, user.object);
	res.redirect("/settings/" + req.params.vm);
});

app.get("/whitectl/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	res.render(__dirname + "/whitectl.jsembeds", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)]),
		whitelist_list: (user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].whitelist || []).map(a => he.encode(a)),
		shareUn: user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].clickbased ? "un" : "",
		vm_id: user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id,
		allUsers: await db.list()
	});
});

app.post("/whitectl/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	if (req.body.based == "0") {
		delete user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].clickbased;
		if (!user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].whitelist) user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].whitelist = [];
		if (!(await db.list()).includes(req.body.username)) return res.status(500).render(__dirname + "/redirector.jsembeds", {
			target: "/whitectl/" + req.params.vm,
			msg: "User doesn't exist or disabled VM sharing, try again later!"
		});
		if ((await db.get(req.body.username)).disableSharing) return res.status(500).render(__dirname + "/redirector.jsembeds", {
			target: "/whitectl/" + req.params.vm,
			msg: "User doesn't exist or disabled VM sharing, try again later!"
		});
		if (user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].whitelist.includes(req.body.username)) return res.redirect("/whitectl/" + req.params.vm)
		user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].whitelist.push(req.body.username);
	} else if (req.body.based == "1") {
		delete user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].whitelist;
		if (!user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].clickbased) user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].clickbased = false;
		user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].clickbased = !user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].clickbased;
	} else {
		return res.status(400).render(__dirname + "/redirector.jsembeds", {
			target: "/settings/" + req.params.vm,
			msg: "Sounds like a malformed request, try again later!"
		});
	}
	await db.set(user.username, user.object);
	res.redirect("/whitectl/" + req.params.vm);
});

app.get("/whitectlReset/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	delete user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].whitelist;
	delete user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].clickbased;
	await db.set(user.username, user.object);
	res.redirect("/whitectl/" + req.params.vm);
});

app.get("/ramset/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	res.render(__dirname + "/ramset.jsembeds", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)])
	});
});

app.post("/ramset/:vm", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	let rams = Number(req.body.ramset);
	if (!rams) return res.status(400).render(__dirname + "/redirector.jsembeds", {
		target: "/ramset/" + req.params.vm,
		msg: "Wrong VM memory amount!"
	});
	rams = Math.round(rams);
	if (rams > 128 && !user.object.isPRO) return res.status(400).render(__dirname + "/redirector.jsembeds", {
		target: "/ramset/" + req.params.vm,
		msg: "Wrong VM memory amount for a non-PRO account!"
	});
	if (rams > 512) return res.status(400).render(__dirname + "/redirector.jsembeds", {
		target: "/ramset/" + req.params.vm,
		msg: "Wrong VM memory amount for a PRO account!"
	});
	if (rams < 8) return res.status(400).render(__dirname + "/redirector.jsembeds", {
		target: "/ramset/" + req.params.vm,
		msg: "Wrong VM memory amount, need at least 8 MB"
	});
	let container = await docker.getContainer(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]].id);
	try {
		await container.update({
			Memory: rams * 1024 * 1024,
			MemorySwap: (rams + 1) * 1024 * 1024
		});
	} catch {
		res.status(500).render(__dirname + "/redirector.jsembeds", {
			target: "/ramset/" + req.params.vm,
			msg: "Something is wrong!"
		});
	}
	res.redirect("/settings/" + req.params.vm);
});

app.get("/newVM", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	if (!user.object.isPRO && Object.keys(user.object.virtuals).length >= 1) {
		return res.status(400).render(__dirname + "/not_pro_yet.jsembeds", {
			username: he.encode(user.username)
		});
	}

	res.render(__dirname + "/newVM.jsembeds", {
		username: he.encode(user.username)
	});
});

app.post("/newVM", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (user.object.blockEnumVM) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/",
		msg: "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator."
	});
	if (!user.object.isPRO && Object.keys(user.object.virtuals).length >= 1) return res.status(400).render(__dirname + "/not_pro_yet.jsembeds", {
		username: he.encode(user.username)
	});
	if (!user.object.isPRO && (req.body.shouldUse512mbRAM || "off") == "on") return res.status(400).end();
	if (!req.body.distro) return res.status(400).end();

	if (!req.body.vm_name) return res.redirect("/newVM");
	if (Object.keys(user.object.virtuals).includes(req.body.vm_name)) return res.redirect("/newVM");
	let distribs = ["debian", "archlinux", "duckcloud/suspiral", "centos"];
	let managedInit = ["duckcloud/suspiral"];
	if (!distribs.includes(req.body.distro)) return res.status(400).end();

	let d = await docker.createContainer({
		Image: req.body.distro,
		AttachStdin: true,
		AttachStdout: true,
		AttachStderr: true,
		Tty: true,
		Cmd: managedInit.includes(req.body.distro) ? ['sh', '/etc/init_exec.sh'] : ['/bin/bash'],
		OpenStdin: true,
		StdinOnce: true,
		NetworkDisabled: ((req.body.shouldHaveNetworking || "off") == "off"),
		HostConfig: {
			Memory: ((req.body.shouldUse512mbRAM || "off") == "on") ? 536870912 : 134217728,
			MemorySwap: ((req.body.shouldUse512mbRAM || "off") == "on") ? 537919488 : 135266304
		}
	});
	let red = await d.inspect();
	user.object.virtuals[req.body.vm_name] = {
		id: red.Id
	};
	await db.set(user.username, user.object);
	await db_virtuals.set(red.Id, { username: user.username, vmname: req.body.vm_name });
	res.redirect("/settings/" + (Object.keys(user.object.virtuals).length - 1));
});

app.get("/logoff", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	res.clearCookie("token");
	return res.redirect("/");
});

app.get("/manage", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	let procodes = await db.get("pro_coder");
	procodes = procodes || {};
	procodes = procodes.procodes || {};
	let fixedprocodes = "";
	for (let procode in procodes) {
		fixedprocodes = fixedprocodes + `<form action="/removeprocode" method="post">
			<input name="code\" value="${he.encode(procode)}" type=\"hidden\" hidden></input>
			<label class="hideWithoutHover" onclick="this.classList.contains('hideWithoutHover')?this.classList.remove('hideWithoutHover'):this.classList.add('hideWithoutHover')"><code>${he.encode(procode)}</code></label> | ${procodes[procode].expiresAfterUsage ? "expires after usage" : "permanent token"}
			<button onclick=\"return confirm('Are you sure?')\" title=\"remove this PRO token\">x</button>
		</form>`;
	}
	res.render(__dirname + "/manage.jsembeds", {
		username: he.encode(user.username),
		disableSharing: (user.object.disableSharing) ? "no sharing" : "accept sharing",
		pfm_adm: (user.username == "pro_coder") ? `${fixedprocodes}
		<br>
		<form action="/createprocode" method="post">
			<input type="checkbox" name="expiresAfterUsage" checked></input> New code expires after usage?
			<br>
			<button>Create PRO token</button>
		</form>` : "Access is denied. Please log in as the correct user.",
		pfm_isenabled: (user.object.isPRO) ? "has" : "doesn't have",
		pfm_cmt_only_nonpro: (user.object.isPRO) ? "<!--" : "",
		pfm_cmtend_only_nonpro: (user.object.isPRO) ? "-->" : "",
		blocked_pro: (user.object.cannotPRO) ? "disabled checked" : "",
		blocked_enum: (user.object.blockEnumVM) ? "disabled checked" : "",
		isRecoveryKeyStale: (user.object.recoveryKey) ? "No" : "Yes"
	});
});

app.post("/changePassword", async function (req, res) {
	if (!req.body.oldPassword) return res.redirect("/manage");
	if (!req.body.newPassword) return res.redirect("/manage");
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (SHA256(req.body.oldPassword) == user.object.password) {
		user.object.password = SHA256(req.body.newPassword);
		await db_tokens.delete(user.object.token);
		user.object.token = genToken(64);
		await db_tokens.set(user.object.token, user.username);
		await db.set(user.username, user.object);
		res.clearCookie("token");
		res.redirect("/");
	} else {
		return res.redirect("/manage");
	}
});

app.post("/destroyAccount", async function (req, res) {
	if (!req.body.password) return res.redirect("/manage");
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (SHA256(req.body.password) == user.object.password) {
		await db_tokens.delete(user.object.token);
		await db.delete(user.username);
		res.clearCookie("token");
		for (let virtual in user.object.virtuals) {
			await db_virtuals.delete(user.object.virtuals[virtual].id);
			let container = docker.getContainer(user.object.virtuals[virtual].id);
			let inspects = await container.inspect();
			if (inspects.State.Running) {
				emitter.removeWorkspace(user.object.virtuals[virtual].id);
				try {
					await container.stop({ t: 0 });
				} catch {}
			}
			await container.remove();
		}
		res.redirect("/");
	} else {
		return res.redirect("/manage");
	}
});

app.post("/changeToken", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	await db_tokens.delete(user.object.token);
	user.object.token = genToken(64);
	await db_tokens.set(user.object.token, user.username);
	await db.set(user.username, user.object);
	res.clearCookie("token");
	res.redirect("/");
});

app.post("/toggle_sharing", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	user.object.disableSharing = !user.object.disableSharing;
	await db.set(user.username, user.object);
	res.render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Successful!"
	});
});

app.post("/pro_apply", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (user.object.isPRO) return res.status(500).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "You already have a PRO flag."
	});
	if (user.object.cannotPRO) return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Access is denied."
	});
	if (!(await db.get("pro_coder"))) return res.status(500).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "This server doesn't have PRO code functionality."
	});
	let codes = await db.get("pro_coder");
	codes = codes.procodes || {};
	if (!codes.hasOwnProperty(req.body.code)) return res.status(404).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Code invalid."
	});
	if (codes.hasOwnProperty(req.body.code)) {
		if (codes[req.body.code].expiresAfterUsage) {
			delete codes[req.body.code];
		}
	}
	let procoder = await db.get("pro_coder");
	procoder.procodes = codes;
	await db.set("pro_coder", procoder);
	user.object.isPRO = true;
	await db.set(user.username, user.object);
	return res.render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "PRO flag acquired successfully."
	});
});

app.post("/removeprocode", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!(await db.get("pro_coder"))) return res.status(500).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "This server doesn't have PRO code functionality."
	});
	if (user.username !== "pro_coder") return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Access is denied."
	});
	let codes = user.object.procodes || {};
	if (!codes.hasOwnProperty(req.body.code)) return res.status(404).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Code invalid."
	});
	if (codes.hasOwnProperty(req.body.code)) {
		delete codes[req.body.code];
	}
	user.object.procodes = codes;
	await db.set(user.username, user.object);
	res.render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Code removed successfully!"
	});
});

app.post("/createprocode", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!(await db.get("pro_coder"))) return res.status(500).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "This server doesn't have PRO code functionality."
	});
	if (user.username !== "pro_coder") return res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Access is denied."
	});
	let codes = user.object.procodes || {};
	let code = genToken(8);
	codes[code] = {
		expiresAfterUsage: (req.body.expiresAfterUsage == "on" ? true : false)
	};
	user.object.procodes = codes;
	await db.set(user.username, user.object);
	res.render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Code created successfully! <code>" + code + "</code>",
		disableRedirect: true
	});
});

app.post("/selfblocking", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	let newFlags = {};
	if (req.body.block_pro == "on" && !user.object.cannotPRO) {
		newFlags.cannotPRO = true;
		if (user.object.isPRO) newFlags.isPRO = false;
	}
	if (req.body.block_enumVM == "on" && !user.object.blockEnumVM) newFlags.blockEnumVM = true;
	if (req.body.block_ID == "on" && !user.object.blockLogin) newFlags.blockLogin = true;
	let userfriendly = "";
	for (let flag in newFlags) {
		if (flag == "cannotPRO") userfriendly = userfriendly + "<em>Disabled the ability to gain PRO flag</em><br>";
		else if (flag == "isPRO") userfriendly = userfriendly + "<em>Disabled the PRO flag</em><br>";
		else if (flag == "blockEnumVM") userfriendly = userfriendly + "<em>Disabled the ability to use virtual machines</em><br>";
		else if (flag == "blockLogin") userfriendly = userfriendly + "<em>Disabled your account</em><br>";
		else userfriendly = userfriendly + `<em>Unknown flag <code>${he.encode(flag||"")}</code> set to <code>${he.encode(newFlags[flag]||"")}</code></em><br>`;
		user.object[flag] = newFlags[flag];
	}
	if (!userfriendly) userfriendly = "<b>No new self-blocks were introduced.</b>";
	await db.set(user.username, user.object);
	res.render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Self-blocking applied successfully!<br>Blocked features:<br>" + userfriendly + "<br>Restrictions were applied as soon as this message popped up.",
		disableRedirect: true
	});
});

app.post("/recoveryKey", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (SHA256(req.body.password) != user.object.password) return res.render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Wrong password."
	});
	let recoveryKey = genToken(512);
	user.object.recoveryKey = SHA256(recoveryKey);
	await db.set(user.username, user.object);
	res.render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Your new recovery key is: <label class=\"hideWithoutHover\" onclick=\"this.classList.contains('hideWithoutHover')?this.classList.remove('hideWithoutHover'):this.classList.add('hideWithoutHover')\"><code>" + he.encode(recoveryKey) + "</code></label><br>Please: store the key in a physical location or a password manager; do not give the key to anyone except the email you see in <a href=\"/contact\" target=\"_blank\" rel=\"noopener noreferrer\">contact us page</a> (this opens in a new tab); rotate the key after a successful account recovery (it IS required!); do not use the recovery key when you don't need it; do not use the recovery key as a password to another service.",
		disableRedirect: true
	});
});

app.get("/xterm/lib/xterm.js", function (req, res) {
	res.sendFile(__dirname + "/node_modules/xterm/lib/xterm.js");
});

app.get("/xterm/css/xterm.css", function (req, res) {
	res.sendFile(__dirname + "/node_modules/xterm/css/xterm.css");
});

app.get("/apidocs", async function (req, res) {
	if (!req.cookies.token) return res.redirect("/");
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	res.render(__dirname + "/apidocs.jsembeds", {
		username: he.encode(user.username)
	});
});

app.get("/cors", async function (req, res) {
	if (new URL(req.headers["referer"] || `http://${req.hostname}`).hostname == req.hostname) {
		res.render(__dirname + "/corsmanager.jsembeds", {
			ipmods: (ips[req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "0.0.0.0"]||[])
		});
	} else {
		res.render(__dirname + "/autoaddcors.jsembeds", {
			refDom: he.encode(new URL(req.headers["referer"] || `http://${req.hostname}`).hostname),
			refUrl: he.encode(encodeURI(req.headers["referer"] || `http://${req.hostname}`))
		});
	}
});

app.get("/botpuzzl", async function (req, res) {
	if (!req.cookies.token) {
		return res.send(
			"alert('Oh no! You must log in to get to the puzzle.');location.href='/';".split("")
			.map(a => String.fromCharCode((a.charCodeAt() ^ 42) + 65))
			.join("")
		);
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.send(
			"alert('Oh no! You must log in to get to the puzzle.');location.href='/';".split("")
			.map(a => String.fromCharCode((a.charCodeAt() ^ 42) + 65))
			.join("")
		);
	}
	let tested = ["host", "user-agent", "accept", "accept-language", "accept-encoding", "connection"];
	let insecure_b0tz = ["curl/", "Wget/"];
	for (let hdr of tested) {
		if (!req.headers[hdr]) return res.send(
			"alert('Sorry, the bot check has failed. If you think this was in error, submit an issue on GitHub.');location.href='/';".split("")
			.map(a => String.fromCharCode((a.charCodeAt() ^ 42) + 65))
			.join("")
		);
	}
	for (let bot of insecure_b0tz) {
		if (req.headers["user-agent"].includes(bot)) return res.send(
			"alert('Sorry, the bot check has failed. If you think this was in error, submit an issue on GitHub.');location.href='/';".split("")
			.map(a => String.fromCharCode((a.charCodeAt() ^ 42) + 65))
			.join("")
		);
	}
	let evald_code = "";
	let date = Date.now() / 5000;
	date = Math.floor(date);
	let ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || genToken(64);
	let datandip = date + ip + ip + date;
	if (date % 10 > 5) datandip = datandip + datandip;
	for (let a in datandip) {
		evald_code = evald_code + Number(datandip[a].charCodeAt());
		if (a % 2 == 0) {
			if (a % 3 == 0) {
				evald_code = evald_code + "+";
			} else {
				evald_code = evald_code + "-";
			}
		}
	}
	if (evald_code.endsWith("+") || evald_code.endsWith("-")) evald_code = evald_code.split("", evald_code.length - 1).join("");
	evald_code = evald_code.split("").map(a => String.fromCharCode((a.charCodeAt() ^ 42) + 65)).join("");
	res.send(evald_code);
});

app.post("/cors", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/cors");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/cors");
	}
	let tested = ["host", "user-agent", "accept", "accept-language", "accept-encoding", "connection"];
	let insecure_b0tz = ["curl/", "Wget/"];
	for (let hdr of tested)
		if (!req.headers[hdr]) return res.redirect("/cors");
	for (let bot of insecure_b0tz)
		if (req.headers["user-agent"].includes(bot)) return res.redirect("/cors");
	if (new URL(req.headers.origin).hostname != req.hostname) return res.redirect("/cors");
	let evald_code = "";
	let date = Date.now() / 5000;
	date = Math.floor(date);
	let ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || genToken(64);
	let datandip = date + ip + ip + date;
	if (date % 10 > 5) datandip = datandip + datandip;
	for (let a in datandip) {
		evald_code = evald_code + Number(datandip[a].charCodeAt());
		if (a % 2 == 0) {
			if (a % 3 == 0) {
				evald_code = evald_code + "+";
			} else {
				evald_code = evald_code + "-";
			}
		}
	}
	if (evald_code.endsWith("+") || evald_code.endsWith("-")) evald_code = evald_code.split("", evald_code.length - 1).join("");
	evald_code = eval(evald_code);
	if (evald_code != req.body.botpuzzl_solvd) return res.render(__dirname + "/redirector.jsembeds", {
		target: "/cors",
		msg: "Invalid bot verification code. (Please make your network less slow!!)"
	});
	ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "0.0.0.0";
	if (!ips[ip]) ips[ip] = [];
	ips[ip].push(req.body.domain);
	res.render(__dirname + "/redirector.jsembeds", {
		target: "/cors",
		msg: "New network service can now use DuckCloud APIs!"
	});
});
app.get("/corsReset", async function (req, res) {
	let ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "0.0.0.0";
	ips[ip] = [];
	res.render(__dirname + "/redirector.jsembeds", {
		target: "/cors",
		msg: "Network services can no longer use DuckCloud APIs."
	});
});

app.get("/contact", function(req, res) {
	res.render(__dirname + "/contactInfo.jsembeds", {
		adminemail: admin_email
	});
});

app.get("/not_implemented", async function(req, res) {
	res.status(501).sendFile(__dirname + "/not_implemented.html");
});

app.use(function (req, res) {
	res.sendFile(__dirname + "/not_found.html");
});

io.on("connection", async function (client) {
	if (fs.existsSync(__dirname + "/duckcloud.blok")) return client.disconnect();
	if (!client.handshake.headers.cookie) return client.disconnect();
	if (!cookie.parse(client.handshake.headers.cookie).token) return client.disconnect();
	let user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
	if (!user) return client.disconnect();
	let disconn = false;
	client.on("disconnect", function () {
		disconn = true;
	});
	client.once("vmselect", async function (vm) {
		user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
		if (user) {
			if (user.object.blockEnumVM) {
				client.emit("datad", "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.");
				return client.disconnect();
			}
		} else return client.disconnect();
		if (!Object.keys(user.object.virtuals)[Number(vm)]) return client.disconnect();
		let a = all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(vm)]].id] || {
			ats: true
		};
		if (user.object.blockEnumVM) {
			disconn = true;
			client.emit("datad", "\r\nThis operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.");
			return client.disconnect();
		}
		if (a.ats) {
			disconn = true;
			client.emit("datad", "\r\nYour virtual machine is about to stop (e2). To use this Linux console again, restart your VM.");
			return client.disconnect();
		}
		if (a.shell.length > 131072) {
			client.emit("datad", "DuckCloud VM buffer cleaning recommended (e6). Please do a `clear` command as soon as possible. Only the last 128kb of shell will be sent.\r\n");
			let shl = a.shell.toString();
			shl = shl.match(/.{1,131072}/g);
			shl = shl[shl.length - 1];
			client.emit("datad", shl);
		} else {
			client.emit("datad", a.shell.toString());
		}
		let workspace = emitter.goToWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(vm)]].id);
		workspace.on("data", async function (e) {
			if (disconn) return;
			user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
			if (user) {
				if (user.object.blockEnumVM) {
					client.emit("datad", "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.");
					return client.disconnect();
				}
			} else return client.disconnect();
			client.emit("datad", e.toString());
		});
		workspace.on("deletion", async function () {
			if (disconn) return;
			user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
			if (user) {
				if (user.object.blockEnumVM) {
					client.emit("datad", "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.");
					return client.disconnect();
				}
			} else return client.disconnect();
			client.emit("datad", "\r\nYour virtual machine is about to stop (e2). To use this Linux console again, restart your VM.")
			return client.disconnect();
		});
		client.on("datad", async function (e) {
			if (typeof e !== "string" && typeof e !== "number") {
				disconn = true;
				return client.disconnect();
			}
			user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
			if (user) {
				if (user.object.blockEnumVM) {
					client.emit("datad", "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.");
					return client.disconnect();
				}
			} else return client.disconnect();
			a.started_shell.write(String(e || ""));
		});
		client.on("resize", async function (w, h) {
			if (typeof w !== "number" || typeof h !== "number") {
				disconn = true;
				return client.disconnect();
			}
			user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
			if (user) {
				if (user.object.blockEnumVM) {
					disconn = true;
					client.emit("datad", "\r\nThis operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.");
					return client.disconnect();
				}
			} else return client.disconnect();
			a.exec.resize({
				w: w,
				h: h
			});
		})
	});
	client.once("tcp_vmselect", async function (vm, port) {
		user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
		if (user) {
			if (user.object.blockEnumVM) {
				client.emit("datad", "This operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.");
				return client.disconnect();
			}
		} else return client.disconnect();
		let id = "";
		if (typeof vm === "number") {
			if (!Object.keys(user.object.virtuals)[Number(vm)]) return client.disconnect();
			id = user.object.virtuals[Object.keys(user.object.virtuals)[Number(vm)]].id;
		}
		if (typeof vm === "string") {
			let base = await db_virtuals.get(user);
			let virt = await db.get(base.username).virtuals[base.vmname];
			if (virt.clickbased) id = virt.id;
			else if (virt.whitelist) {
				if (virt.whitelist.includes(user.username)) id = vm;
			}
		}
		if (!id) {
			client.emit("datad", "Error creating any sort of connection (e1).\nThe root cause:\n\tMay be because you are not included in the whitelist of the target VM and click-based settings aren't enabled.\nHow to fix:\n\tContact the VM owner to include you in the whitelist. You shouldn't contact the system administrator in this case - most likely they won't help.");
			return client.disconnect();
		}
		if (typeof port !== "number") return client.disconnect();
		if (port > 65536) return client.disconnect();
		if (port < 0) return client.disconnect();
		// TCP Socket handling
		let connection;
		try {
			let container = await docker.getContainer(id);
        	let inspected = await container.inspect();
			if (!inspected.State.Running) {
				client.emit("datad", "Error creating any sort of connection (e2).\nThe root cause:\n\tThe VM isn't running.\nHow to fix:\n\tStart the VM and the TCP service to continue. Or if this isn't your VM - contact the owner.");
				return client.disconnect();
			}
			connection = net.createConnection(port, inspected.NetworkSettings.IPAddress);
		} catch {
			client.emit("datad", "Error creating any sort of connection (e3).\nThe root cause:\n\tThe VM isn't visible on the Docker list or the connection has failed when creating.\nHow to fix:\n\tThink about your server. Check if you are listening on localhost - you need to listen on 0.0.0.0.");
			return client.disconnect();
		}
		connection.on("error", function() {
			client.emit("datad", "Error while using connection (e4).\nThe root cause:\n\tThe connection was reset or failed. It's really unexplainable.\nPossible fixes:\n\tThink about your server. Check if you are listening on localhost - you need to listen on 0.0.0.0.");
			return client.disconnect();
		});
		connection.on("close", () => client.disconnect());
		connection.on("end", () => client.disconnect());
		connection.on("data", async function(tcpBuf) {
			user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
			if (user) {
				if (user.object.blockEnumVM) {
					client.emit("datad", "\r\nThis operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.");
					return client.disconnect();
				}
			} else return client.disconnect();
			client.emit("datad", tcpBuf);
		});
		// Socket.IO handling
		client.on("datad", async function(tcpBuf) {
			user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
			if (user) {
				if (user.object.blockEnumVM) {
					client.emit("datad", "\r\nThis operation has been cancelled due to self-blocking in effect on your account (e5). Please contact the system administrator.");
					return client.disconnect();
				}
			} else return client.disconnect();
			connection.write(tcpBuf);
		});
		client.once("disconnect", function() {
			connection.resetAndDestroy();
			return client.disconnect();
		});
	});
})

http.listen(3000, () => {
	console.log('server started');
});