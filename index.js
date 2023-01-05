//Start up the modules
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const he = require("he");
const fs = require("fs");
const crypto = require("crypto");
const dockerode = require('dockerode');
const engine = require("jsembedtemplateengine");
const docker = new dockerode();
const app = express();
const db = {
	get: async function(item) {
		return this.db[item];
	},
	set: async function(item, content) {
		var db = JSON.parse(JSON.stringify(this.db));
		db[item] = content;
		this.db = db;
	},
	delete: async function(item) {
		var db = JSON.parse(JSON.stringify(this.db));
		delete db[item];
		this.db = db;
	},
	list: async function() {
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
const promisifyStream = stream => new Promise((resolve, reject) => {
	let myData = Buffer.from("");
	stream.on('data', data => myData = Buffer.concat([myData, data]))
	stream.on('end', () => resolve(myData))
	stream.on('error', reject)
});
let all_features = {};
engine(app, {
	embedOpen: "<nodejs-embed>",
	embedClose: "</nodejs-embed>"
});
app.set('views', '.')
app.set('view engine', 'jsembeds');

//Assign some middleware
app.use(bodyParser.urlencoded({extended: true, limit: "128mb"}));
app.use(bodyParser.json({limit: "128mb"}));
app.use(cookieParser());

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
		if (obj.token == token) return { object: obj, username: user, token: token };
	}
	return null;
}

//Get user by DuckCloud assigned token
async function findUserByDuckCloudAssignedToken(token) {
	let users = await db.list();
	for (let user of users) {
		let obj = await db.get(user);
		if (obj.linkedTo == token) return { object: obj, username: user, token: obj.token };
	}
	return null;
}

//Automatic session extension
app.use(function(req, res, next) {
	if (req.cookies.token) {
		res.cookie("token", req.cookies.token, {
			maxAge: 30 * 24 * 60 * 60 * 1000
		});
	}
	next();
});

//And... yep. goodluck! :)
app.get('/', async (req, res) => {
	if (req.cookies.token) {
		return res.redirect("/main");
	}
	res.render(__dirname + "/index.html");
});

app.get('/regular.css', async (req, res) => {
	res.sendFile(__dirname + "/regular.css");
});

app.get("/register", async function(req, res) {
	if (req.cookies.token) {
		return res.redirect("/main");
	}
	res.render(__dirname + "/register.html");
});

app.post("/register", async function(req, res) {
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
        isPRO: false
	});
	return res.redirect("/");
});

app.post("/login", async function(req, res) {
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

app.get("/main", async function(req, res) {
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
			dockers = dockers + "<div class=\"object\" style=\"position: relative; top: " + top + "px;\"><b>" + he.encode(vm) + " </b><div class=\"" + state + "-icon\">dk</div><a href=\"/settings/" + Object.keys(user.object.virtuals).indexOf(vm) + "\" class=\"arrow manage-vm\">→</a></div>";
		}
	}
    res.render(__dirname + "/template.html", {
		username: he.encode(user.username),
		dockers: dockers
	});
});

app.get("/settings/:vm", async function(req, res) {
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
    res.render(__dirname + "/template_2.html", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)]),
		switch: state.State.Running ? "Turn off" : "Turn on"
	});
});

app.get("/burn/:vm", async function(req, res) {
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
	if (state.State.Running) {
		if (all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]]) {
			if (!all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]].ats) {
				all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
					ats: true
				};
				await container.stop();
			} else {
				return res.redirect("/settings/" + req.params.vm);
			}
		} else {
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
				ats: true
			};
			await container.stop();
		}
	}
	for (let vm in user.object.virtuals) {
		if (vm == exclude_name) continue;
		newList[vm] = user.object.virtuals[vm];
	}
	user.object.virtuals = newList;
	await db.set(user.username, user.object);
	await container.remove();
	res.redirect("/main");
});

app.get("/shutoff/:vm", async function(req, res) {
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
		await container.stop();
	}
	if (!state.State.Running) {
		try {
			await container.start();
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
				shell: Buffer.from("Welcome to your DuckCloud VM!\r\n"),
				ats: false
			};
			let our_vm = all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]];
			our_vm.exec = await container.exec({Cmd: ['/bin/bash'], Tty: true, AttachStdin: true, AttachStdout: true, AttachStderr: true, Privileged: true });
			our_vm.started_shell = await our_vm.exec.start({ Tty: true, stdin: true });
			our_vm.started_shell.on("data", function(a) {
				our_vm.shell = Buffer.concat([our_vm.shell, a]);
				all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = our_vm;
			});
			our_vm.started_shell.on("end", async function() {
				our_vm.ats = true;
				await container.stop();
				all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = { ats: true };
				our_vm = {};
			});
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = our_vm;
		} catch {
			all_features[user.object.virtuals[Object.keys(user.object.virtuals)[Number(req.params.vm)]]] = {
				ats: true
			};
			if (state.State.Running) {
				await container.stop();
			}
			return res.status(500).render(__dirname + "/failed_to_start.html", {
				username: he.encode(user.username)
			});
		}
	}
	res.redirect("/settings/" + req.params.vm);
});

app.get("/chown/:vm", async function(req, res) {
    if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!Object.keys(user.object.virtuals)[Number(req.params.vm)]) return res.redirect("/main");
    res.render(__dirname + "/chown.html", {
		username: he.encode(user.username),
		vm_count: req.params.vm,
		vm_name: he.encode(Object.keys(user.object.virtuals)[Number(req.params.vm)])
	});
});

app.post("/chown/:vm", async function(req, res) {
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
	if (!newOwner.isPRO && Object.keys(newOwner.virtuals).length) {
		return res.render(__dirname + "/target_not_pro_yet.html", {
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

app.post("/newInput/:vm", async function(req, res) {
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

app.get("/sendInput/:vm", async function(req, res) {
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
	our_vm.started_shell.write(req.query.new);
	res.send("ok");
});

app.get("/resize/:vm", async function(req, res) {
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
	our_vm.exec.resize({ w: req.query.w, h: req.query.h });
	res.send("ok");
});

app.get("/newVM", async function(req, res) {
    if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!user.object.isPRO && Object.keys(user.object.virtuals).length >= 1) {
		return res.status(400).render(__dirname + "/not_pro_yet.html", {
			username: he.encode(user.username)
		});
	}
    
	res.render(__dirname + "/newVM.html", {
		username: he.encode(user.username)
	});
});

app.post("/newVM", async function(req, res) {
    if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	if (!user.object.isPRO && Object.keys(user.object.virtuals).length >= 1) {
		return res.status(400).render(__dirname + "/not_pro_yet.html", {
			username: he.encode(user.username)
		});
	}
	if (!user.object.isPRO && (req.body.shouldUse512mbRAM || "off") == "on") {
		return res.status(400).end();
	}

	if (!req.body.vm_name) return res.redirect("/newVM");
	if (Object.keys(user.object.virtuals).includes(req.body.vm_name)) return res.redirect("/newVM");
	let d = await docker.createContainer({
		Image: 'debian',
		AttachStdin: false,
		AttachStdout: true,
		AttachStderr: true,
		Tty: true,
		Cmd: ['/bin/bash'],
		OpenStdin: false,
		StdinOnce: false,
		NetworkDisabled: ((req.body.shouldHaveNetworking || "off") == "off"),
		HostConfig: {
			Memory: ((req.body.shouldUse512mbRAM || "off") == "on") ? 536870912 : 134217728,
			MemorySwap: ((req.body.shouldUse512mbRAM || "off") == "on") ?  537919488 : 135266304
		}
	});
	let red = await d.inspect();
	user.object.virtuals[req.body.vm_name] = red.Id;
	await db.set(user.username, user.object);
	res.redirect("/main");
});

app.get("/logoff", async function(req, res) {
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

app.get("/ul_link", async function(req, res) {
	if (req.cookies.token) return res.redirect("/main");
	if (req.cookies.token_createfor) return res.redirect("/user_page");
	if (!req.query.deviceID) res.redirect("https://ultimatelogon.pcprojects.tk/oauth?requestToken=a&followLink=" + encodeURIComponent("http://" + req.hostname + ":3000/ul_link") + "&companyName=DuckCloud");
	let devdet = await fetch("https://ultimatelogon.pcprojects.tk/deviceDetails?device=" + req.query.deviceID);
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
	let data = await fetch("https://ultimatelogon.pcprojects.tk/appdata", {
		headers: {
			"Cookie": "token=" + json.user.token
		}
	});
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
app.get("/user_page", async function(req, res) {
	if (req.cookies.token) return res.redirect("/main");
	if (!req.cookies.token_createfor) return res.redirect("/ul_link");
	let a = await fetch("https://ultimatelogon.pcprojects.tk/username_scripting", {
		headers: {
			"Cookie": "token=" + req.cookies.token_createfor
		}
	});
	if (!a.ok) {
		res.clearCookie("token_createfor");
		return res.redirect("/ul_link");
	}
	res.render(__dirname + "/select_user_type.html", {
		username: he.encode(await a.text())
	});
});
app.post("/user_page", async function(req, res) {
	if (req.cookies.token) return res.redirect("/main");
	if (!req.cookies.token_createfor) return res.redirect("/ul_link");
	let a = await fetch("https://ultimatelogon.pcprojects.tk/username_scripting", {
		headers: {
			"Cookie": "token=" + req.cookies.token_createfor
		}
	});
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
		let data = await fetch("https://ultimatelogon.pcprojects.tk/appdata", {
			headers: {
				"Cookie": "token=" + req.cookies.token_createfor
			}
		});
		data = await data.json();
		data["duckcloud_token"] = token;
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
		if (SHA256(req.body.old_pass) == user.password) {
			user.linkedTo = token;
			await db.set(req.body.old_user, user);
		} else {
			return res.redirect("/ul_link");
		}
	} else {
		let user = await fetch("https://ultimatelogon.pcprojects.tk/username_scripting", {
			headers: {
				"Cookie": "token=" + req.cookies.token_createfor
			}
		});
		user = await user.text();
		await db.set(user, {
			password: req.cookies.createfor_password,
			token: genToken(16),
			virtuals: {},
			isPRO: false,
			assignedTo: token
		});
	}
	res.clearCookie("token_createfor");
	res.clearCookie("createfor_password");
	res.redirect("/");
});

app.get("/manage", async function(req, res) {
	if (!req.cookies.token) {
		return res.redirect("/");
	}
	let user = await getUserByToken(req.cookies.token);
	if (!user) {
		res.clearCookie("token");
		return res.redirect("/");
	}
	res.render(__dirname + "/manage.html", {
		username: he.encode(user.username),
		associatedCS: (user.object.linkedTo) ? "" : "<!--",
		associatedCE: (user.object.linkedTo) ? "" : "-->"
	});
});

app.post("/changePassword", async function(req, res) {
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
		//Intended behaviour.
		res.clearCookie("token");
		res.redirect("/");
	} else {
		return res.redirect("/manage");
	}
});

app.post("/destroyAccount", async function(req, res) {
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
		for (let virtual in user.object.virtuals) {
			let container = docker.getContainer(user.object.virtuals[virtual]);
			let inspects = await container.inspect();
			if (inspects.State.Running) await container.stop();
			await container.remove();
		}
		await db.delete(user.username);
		res.clearCookie("token");
		res.redirect("/");
	} else {
		return res.redirect("/manage");
	}
});

app.post("/changeToken", async function(req, res) {
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

app.post("/ul_unlink", async function(req, res) {
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
		res.send("Successful!<br><a href=\"/manage\">Back to management settings</a><script>onload=function(){onload=null;setTimeout(function(){location.href='/manage'},1000);}</script>")
	} else {
		return res.redirect("/manage");
	}
});

app.get("/xterm/lib/xterm.js", function(req, res) {
	res.sendFile(__dirname + "/node_modules/xterm/lib/xterm.js");
});

app.get("/xterm/css/xterm.css", function(req, res) {
	res.sendFile(__dirname + "/node_modules/xterm/css/xterm.css");
});

app.listen(3000, () => {
	console.log('server started');
});