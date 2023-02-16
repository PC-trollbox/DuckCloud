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
	let endToken = "";
	while (endToken.length < long) {
		endToken = endToken + crypto.randomBytes(1).toString("hex");
	}
	return endToken.split("", long).join("");
}

//Get user by token
async function getUserByToken(token) {
	let users = await db.list();
	for (let user of users) {
		let obj = await db.get(user);
		if (obj.token == token) return {
			object: obj,
			username: user,
			token: token
		};
	}
	return null;
}

//Get user by DuckCloud assigned token
async function findUserByDuckCloudAssignedToken(token) {
	let users = await db.list();
	for (let user of users) {
		let obj = await db.get(user);
		if (obj.linkedTo == token) return {
			object: obj,
			username: user,
			token: obj.token
		};
	}
	return null;
}

//Automatic session extension
app.use(function (req, res, next) {
	if (req.cookies.token) {
		res.cookie("token", req.cookies.token, {
			maxAge: 30 * 24 * 60 * 60 * 1000
		});
	}
	let ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "0.0.0.0";
	if (ips.hasOwnProperty(ip)) {
		if (ips[ip].includes(new URL(req.headers.origin || "http://non-existing.domain.loc").host)) {
			res.set("Access-Control-Allow-Origin", "*");
			res.set("Access-Control-Allow-Credentials", "true");
		}
	}
	next();
});

//And... yep. goodluck! :)
app.get('/', async (req, res) => {
	if (req.cookies.token) {
		return res.redirect("/main");
	}
	res.render(__dirname + "/index.jsembeds");
});

app.get('/regular.css', async (req, res) => {
	res.sendFile(__dirname + "/regular.css");
});

app.get("/register", async function (req, res) {
	if (req.cookies.token) {
		return res.redirect("/main");
	}
	res.render(__dirname + "/register.jsembeds");
});

app.post("/register", async function (req, res) {
	if (req.cookies.token) {
		return res.redirect("/main");
	}
	if (!req.body.username) return res.redirect("/register");
	if (!req.body.password) return res.redirect("/register");
	if ((await db.list()).includes(req.body.username)) {
		return res.redirect("/register");
	}
	await db.set(req.body.username, {
		password: SHA256(req.body.password),
		token: genToken(64),
		virtuals: {},
		isPRO: false,
		disableSharing: true
	});
	return res.redirect("/");
});

app.post("/login", async function (req, res) {
	if (req.cookies.token) {
		return res.redirect("/main");
	}
	if (!req.body.username) return res.redirect("/");
	if (!req.body.password) return res.redirect("/");
	if (!((await db.list()).includes(req.body.username))) {
		return res.redirect("/");
	}
	let user = await db.get(req.body.username);
	if (SHA256(req.body.password) == user.password) {
		res.cookie("token", user.token, {
			maxAge: 30 * 24 * 60 * 60 * 1000
		});
	} else {
		return res.redirect("/");
	}
	res.redirect("/main");
});

app.get("/main", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	let dockers = "";
	if (user.object.virtuals) {
		for (let vm in user.object.virtuals) {
			let top = 0;
			let container = docker.getContainer(user.object.virtuals[vm]);
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
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	let dockers = [];
	if (user.object.virtuals) {
		for (let vm in user.object.virtuals) {
			let container = docker.getContainer(user.object.virtuals[vm]);
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
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	let container = docker.getContainer(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
	let state = await container.inspect();
	res.render(__dirname + "/template_2.jsembeds", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)]),
		switch: state.State.Running ? "Turn off" : "Turn on"
	});
});

app.get("/burn/:vm", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	let exclude_name = Object.keys(user.object.virtuals)[Number(req.params.vm)];
	let newList = {};
	let container = docker.getContainer(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
	let state = await container.inspect();
	let wasAlrRem = false;
	if (state.State.Running) {
		if (all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]]) {
			if (!all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]].ats) {
				all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
					ats: true
				};
				wasAlrRem = true;
				emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
				for (let vm in user.object.virtuals) {
					if (vm == exclude_name) continue;
					newList[vm] = user.object.virtuals[vm];
				}
				user.object.virtuals = newList;
				await db.set(user.username, user.object);
				try {
					await container.stop();
				} catch {}
			} else {
				return res.redirect("/settings/" + req.params.vm);
			}
		} else {
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
				ats: true
			};
			wasAlrRem = true;
			emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
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
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	let container = docker.getContainer(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
	let state = await container.inspect();
	if (all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] && state.State.Running) {
		if (all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]].ats) {
			return res.redirect("/settings/" + req.params.vm);
		}
	}
	if (state.State.Running) {
		all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
			ats: true
		};
		emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
		try {
			await container.stop();
		} catch {}
	}
	if (!state.State.Running) {
		try {
			let d = emitter.goToWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
			await container.start();
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
				shell: Buffer.from("Welcome to your DuckCloud VM!\r\n"),
				ats: false
			};
			let our_vm = all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]];
			our_vm.exec = await container.exec({
				Cmd: ['/bin/bash'],
				Tty: true,
				AttachStdin: true,
				AttachStdout: true,
				AttachStderr: true,
				Privileged: true
			});
			our_vm.started_shell = await our_vm.exec.start({
				Tty: true,
				stdin: true
			});
			our_vm.started_shell.on("data", function (a) {
				if ((our_vm.shell.length + a.length) < require("buffer").constants.MAX_STRING_LENGTH) {
					our_vm.shell = Buffer.concat([our_vm.shell, a]);
					d.emit("data", a);
					if (our_vm.shell.toString().includes("\x1b[H\x1b[2J")) {
						our_vm.shell = Buffer.from(our_vm.shell.toString().split("\x1b[H\x1b[2J")[our_vm.shell.toString().split("\x1b[H\x1b[2J").length - 1]);
					}
					all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = our_vm;
				} else {
					if (a.length < require("buffer").constants.MAX_STRING_LENGTH) {
						our_vm.shell = Buffer.concat([Buffer.from("Required cleaning of shell by Node.JS limits.\r\n"), a]);
					}
				}
			});
			our_vm.started_shell.on("end", async function () {
				our_vm.ats = true;
				emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
				try {
					await container.stop();
				} catch {}
				all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
					ats: true
				};
				our_vm = {};
			});
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = our_vm;
		} catch {
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
				ats: true
			};
			state = await container.inspect();
			if (state.State.Running) {
				emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
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
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	res.render(__dirname + "/chown.jsembeds", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)])
	});
});

app.post("/chown/:vm", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
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
	await db.set(user.username, user.object);
	await db.set(req.body.username, newOwner);
	res.redirect("/main");
});

app.get("/ren/:vm", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	res.render(__dirname + "/rename.jsembeds", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)])
	});
});

app.post("/ren/:vm", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
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
	await db.set(user.username, user.object);
	res.redirect("/settings/" + req.params.vm);
});

app.post("/newInput/:vm", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	let our_vm = all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]];
	if (!our_vm) return res.end();
	if (our_vm.ats) {
		return res.send("\r\nYour virtual machine is about to stop. To use this Linux console again, restart your VM.");
	}
	res.send(our_vm.shell);
});

app.get("/sendInput/:vm", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	let our_vm = all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]];
	if (!our_vm) return res.end();
	if (our_vm.ats) {
		return res.send("\r\nYour virtual machine is about to stop. To use this Linux console again, restart your VM.");
	}
	if (typeof req.query.new !== "string") return res.send("soft fail");
	our_vm.started_shell.write(String(req.query.new || "") || "");
	res.send("ok");
});

app.get("/resize/:vm", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
	let our_vm = all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]];
	if (!our_vm) return res.end();
	if (our_vm.ats) {
		return res.send("\r\nYour virtual machine is about to stop. To use this Linux console again, restart your VM.");
	}
	if (isNaN(Number(req.query.w)) || !isFinite(Number(req.query.w))) return res.send("soft fail");
	if (isNaN(Number(req.query.h)) || !isFinite(Number(req.query.h))) return res.send("soft fail");
	our_vm.exec.resize({
		w: req.query.w,
		h: req.query.h
	});
	res.send("ok");
});

app.get("/newVM", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
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
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!user.object.isPRO && Object.keys(user.object.virtuals).length >= 1) {
		return res.status(400).render(__dirname + "/not_pro_yet.jsembeds", {
			username: he.encode(user.username)
		});
	}
	if (!user.object.isPRO && (req.body.shouldUse512mbRAM || "off") == "on") {
		return res.status(400).end();
	}
	if (!req.body.distro) {
		return res.status(400).end();
	}

	if (!req.body.vm_name) return res.redirect("/newVM");
	if (Object.keys(user.object.virtuals).includes(req.body.vm_name)) return res.redirect("/newVM");
	let distribs = ["debian", "archlinux", "duckcloud/suspiral"];
	if (!distribs.includes(req.body.distro)) return res.status(400).end();

	let d = await docker.createContainer({
		Image: req.body.distro,
		AttachStdin: false,
		AttachStdout: true,
		AttachStderr: true,
		Tty: true,
		Cmd: req.body.distro === "duckcloud/suspiral" ? ['sh', '/etc/init_exec.sh'] : ['/bin/bash'],
		OpenStdin: false,
		StdinOnce: false,
		NetworkDisabled: ((req.body.shouldHaveNetworking || "off") == "off"),
		HostConfig: {
			Memory: ((req.body.shouldUse512mbRAM || "off") == "on") ? 536870912 : 134217728,
			MemorySwap: ((req.body.shouldUse512mbRAM || "off") == "on") ? 537919488 : 135266304
		}
	});
	let red = await d.inspect();
	user.object.virtuals[req.body.vm_name] = red.Id;
	await db.set(user.username, user.object);
	res.redirect("/main");
});

app.get("/logoff", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	res.clearCookie("token");
	return res.redirect("/");
});

app.get("/ul_link", async function (req, res) {
	if (req.cookies.token) return res.redirect("/main");
	if (req.cookies.token_createfor) return res.redirect("/user_page");
	if (!req.query.deviceID) res.redirect("https://ultimatelogon.pcprojects.tk/oauth?requestToken=a&followLink=" + encodeURIComponent("http://" + req.hostname + ":3000/ul_link") + "&companyName=DuckCloud");
	let devdet = {
		ok: false
	};
	try {
		devdet = await fetch("https://ultimatelogon.pcprojects.tk/deviceDetails?device=" + req.query.deviceID);
	} catch (e) {}
	if (!devdet.ok) {
		return res.status(400).end();
	}
	let json;
	try {
		json = await devdet.json();
	} catch (err) {
		return res.status(400).end();
	}
	//You might want to save data here.
	res.cookie("token_createfor", json.user.token);
	res.cookie("createfor_password", json.user.password)
	let data = {
		json: function () {}
	};
	try {
		data = await fetch("https://ultimatelogon.pcprojects.tk/appdata", {
			headers: {
				"Cookie": "token=" + json.user.token
			}
		});
	} catch {

	}
	data = await data.json();
	if (data.duckcloud_token) {
		let user = await findUserByDuckCloudAssignedToken(data.duckcloud_token);
		if (!user) return res.redirect("/user_page");
		res.clearCookie("token_createfor");
		res.clearCookie("createfor_password");
		if (user.object.block_ul) {
			return res.redirect("https://ultimatelogon.pcprojects.tk/blocked_user?appName=DuckCloud")
		}
		res.cookie("token", user.token, {
			maxAge: 30 * 24 * 60 * 60 * 1000
		});
		return res.redirect("/main");
	}
	res.redirect("/user_page");
});
app.get("/user_page", async function (req, res) {
	if (req.cookies.token) return res.redirect("/main");
	if (!req.cookies.token_createfor) return res.redirect("/ul_link");
	let a = {
		ok: false
	}
	try {
		a = await fetch("https://ultimatelogon.pcprojects.tk/username_scripting", {
			headers: {
				"Cookie": "token=" + req.cookies.token_createfor
			}
		});
	} catch {

	}
	if (!a.ok) {
		res.clearCookie("token_createfor");
		return res.redirect("/ul_link");
	}
	res.render(__dirname + "/select_user_type.jsembeds", {
		username: he.encode(await a.text())
	});
});
app.post("/user_page", async function (req, res) {
	if (req.cookies.token) return res.redirect("/main");
	if (!req.cookies.token_createfor) return res.redirect("/ul_link");
	let a = {
		ok: false
	};
	try {
		a = await fetch("https://ultimatelogon.pcprojects.tk/username_scripting", {
			headers: {
				"Cookie": "token=" + req.cookies.token_createfor
			}
		});
	} catch {}
	if (!a.ok) {
		res.clearCookie("token_createfor");
		return res.redirect("/ul_link");
	}
	if (req.body.account_type != "new" && req.body.account_type != "link") return res.redirect("/user_page");
	if (req.body.account_type == "link" && !req.body.old_user) return res.redirect("/user_page");
	if (req.body.account_type == "link" && !req.body.old_pass) return res.redirect("/user_page");
	if (req.body.account_type == "new" && ((await db.list()).includes(await a.text()))) return res.redirect("/ul_link");
	if (req.body.account_type == "link") {
		if (!((await db.list()).includes(req.body.old_user))) {
			return res.redirect("/ul_link");
		}
		let user = await db.get(req.body.old_user);
		if (user.block_ul) {
			return res.redirect("https://ultimatelogon.pcprojects.tk/blocked_user?appName=DuckCloud")
		}
		let token = genToken(32);
		let data = {
			json: function () {
				return {}
			}
		};
		try {
			data = await fetch("https://ultimatelogon.pcprojects.tk/appdata", {
				headers: {
					"Cookie": "token=" + req.cookies.token_createfor
				}
			});
		} catch {

		}
		data = await data.json();
		data["duckcloud_token"] = token;
		try {
			await fetch("https://ultimatelogon.pcprojects.tk/appdata", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Cookie": "token=" + req.cookies.token_createfor
				},
				body: JSON.stringify({
					"appdata": JSON.stringify(data)
				})
			});
		} catch {

		}
		if (SHA256(req.body.old_pass) == user.password) {
			user.linkedTo = token;
			await db.set(req.body.old_user, user);
		} else {
			return res.redirect("/ul_link");
		}
	} else {
		try {
			let user = await fetch("https://ultimatelogon.pcprojects.tk/username_scripting", {
				headers: {
					"Cookie": "token=" + req.cookies.token_createfor
				}
			});
			user = await user.text();
			await db.set(user, {
				password: req.cookies.createfor_password,
				token: genToken(64),
				virtuals: {},
				isPRO: false,
				assignedTo: token,
				disableSharing: true
			});
		} catch {}
	}
	res.clearCookie("token_createfor");
	res.clearCookie("createfor_password");
	res.redirect("/");
});

app.get("/manage", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
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
		associatedCS: (user.object.linkedTo) ? "" : "<!--",
		associatedCE: (user.object.linkedTo) ? "" : "-->",
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
		pfm_cmtend_only_nonpro: (user.object.isPRO) ? "-->" : ""
	});
});

app.post("/changePassword", async function (req, res) {
	if (!req.body.oldPassword) return res.redirect("/manage");
	if (!req.body.newPassword) return res.redirect("/manage");
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (SHA256(req.body.oldPassword) == user.object.password) {
		user.object.password = SHA256(req.body.newPassword);
		user.object.token = genToken(64);
		await db.set(user.username, user.object);
		//InVeNTed behaviour.
		res.clearCookie("token");
		res.redirect("/");
	} else {
		return res.redirect("/manage");
	}
});

app.post("/destroyAccount", async function (req, res) {
	if (!req.body.password) return res.redirect("/manage");
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (SHA256(req.body.password) == user.object.password) {
		await db.delete(user.username);
		res.clearCookie("token");
		for (let virtual in user.object.virtuals) {
			let container = docker.getContainer(user.object.virtuals[virtual]);
			let inspects = await container.inspect();
			if (inspects.State.Running) {
				emitter.removeWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]);
				try {
					await container.stop();
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
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	user.object.token = genToken(64);
	await db.set(user.username, user.object);
	res.clearCookie("token");
	res.redirect("/");
});

app.post("/ul_unlink", async function (req, res) {
	if (!req.body.password) return res.redirect("/manage");
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (SHA256(req.body.password) == user.object.password) {
		delete user.object.linkedTo;
		await db.set(user.username, user.object);
		res.render(__dirname + "/redirector.jsembeds", {
			target: "/manage",
			msg: "Successful!"
		});
	} else {
		return res.redirect("/manage");
	}
});

app.post("/toggle_sharing", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
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
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (user.object.isPRO) return res.status(500).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "You already have a PRO flag."
	});
	if (user.object.cannotPRO) return res.status(500).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Access is denied."
	});
	if (!(await db.get("pro_coder"))) return res.status(500).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "This server doesn't have PRO code functionality."
	});
	let codes = await db.get("pro_coder");
	codes = codes.procodes || {};
	if (!codes.hasOwnProperty(req.body.code)) return res.status(500).render(__dirname + "/redirector.jsembeds", {
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
	return res.status(500).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "PRO flag acquired successfully."
	});
});

app.post("/removeprocode", async function (req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
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
	if (!req.cookies.token) {
		return res.redirect("/");
	}
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
	res.status(403).render(__dirname + "/redirector.jsembeds", {
		target: "/manage",
		msg: "Code created successfully! <code>" + code + "</code>",
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
	if (!req.cookies.token) {
		return res.redirect("/");
	}
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
	res.render(__dirname + "/corsmanager.jsembeds", {
		ipmods: (ips[req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "0.0.0.0"]||[])
	});
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

app.use(function (req, res) {
	res.sendFile(__dirname + "/not_found.html");
});

io.on("connection", async function (client) {
	if (!client.handshake.headers.cookie) return client.disconnect();
	if (!cookie.parse(client.handshake.headers.cookie).token) return client.disconnect();
	let user = await getUserByToken(cookie.parse(client.handshake.headers.cookie).token);
	if (!user) return client.disconnect();
	let disconn = false;
	client.on("disconnect", function () {
		disconn = true;
	});
	client.once("vmselect", function (vm) {
		if (!Object.keys(user.object.virtuals)[Number(vm)]) return client.disconnect();
		let a = all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(vm)]]] || {
			ats: true
		};
		if (a.ats) {
			client.emit("datad", "\r\nYour virtual machine is about to stop. To use this Linux console again, restart your VM.");
			return client.disconnect();
		}
		if (a.shell.length > 131072) {
			client.emit("datad", "DuckCloud VM buffer cleaning recommended. Please do a `clear` command as soon as possible. Only the last 128kb of shell will be sent.\r\n");
			let shl = a.shell.toString();
			shl = shl.match(/.{1,131072}/g);
			shl = shl[shl.length - 1];
			client.emit("datad", shl);
		} else {
			client.emit("datad", a.shell.toString());
		}
		let workspace = emitter.goToWorkspace(user.object.virtuals[Object.keys(user.object.virtuals)[Number(vm)]]);
		workspace.on("data", function (e) {
			if (disconn) return;
			client.emit("datad", e.toString());
		});
		workspace.on("deletion", function () {
			if (disconn) return;
			client.emit("datad", "\r\nYour virtual machine is about to stop. To use this Linux console again, restart your VM.")
			return client.disconnect();
		});
		client.on("datad", function (e) {
			if (typeof e !== "string" && typeof e !== "number") {
				disconn = true;
				return client.disconnect();
			}
			a.started_shell.write(String(e || ""));
		});
		client.on("resize", function (w, h) {
			if (typeof w !== "number" || typeof h !== "number") {
				disconn = true;
				return client.disconnect();
			}
			a.exec.resize({
				w: w,
				h: h
			});
		})
	});
})

http.listen(3000, () => {
	console.log('server started');
});