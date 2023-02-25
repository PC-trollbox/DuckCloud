const io = require("socket.io-client");
const net = require("net");
const duckcloud_api = "https://duckcloud.pcprojects.tk";
const vmId = -1;
const token = "";
const port = -1;

if (duckcloud_api == "") {
	return console.error("[DuckCloud API URL missing] Configure testTCPConnect.js, please. If you don't know how - contact your DuckCloud system admin.");
}
console.log("will be using API", duckcloud_api, ", to change please configure testTCPConnect.js");
if (vmId == -1) {
	return console.error("[DuckCloud VM index missing] Configure testTCPConnect.js, please. If you don't know how - contact your DuckCloud system admin.");
}
console.log("will be using VM index", vmId, ", to change please configure testTCPConnect.js");
if (token == "") {
	return console.error("[DuckCloud API token missing] Configure testTCPConnect.js, please. If you don't know how - contact your DuckCloud system admin.");
}
console.log("will be using a token", token.split("", 5).join("") + "*".repeat(token.length - 5), ", to change please configure testTCPConnect.js");
if (port == -1) {
	return console.error("[DuckCloud VM port missing] Configure testTCPConnect.js, please. If you don't know how - contact your DuckCloud system admin.");
}
if (port < 0 || port > 65535) {
	return console.error("[DuckCloud VM port invalid] Configure testTCPConnect.js, please. The port must be in 0-65535 range. If you don't know how to configure - contact your DuckCloud system admin.");
}
console.log("will be connecting to port", port, ", to change please configure testTCPConnect.js");

let srv = net.createServer(function(socket) {
	let socket2 = io(duckcloud_api, {
		transportOptions: {
			polling: {
				extraHeaders: {
					'Cookie': "token=" + token
				}
			}
		}
	});
	socket2.emit("tcp_vmselect", vmId, port);
	socket2.on("datad", function(tcpBuf) {
		socket.write(tcpBuf);
	});
	socket2.on("disconnect", function() {
		socket.destroy();
	});
	socket.on("data", function(tcpBuf) {
		socket2.emit("datad", tcpBuf);
	});
	socket.on("end", function() {
		socket2.destroy();
	});
	socket.on("close", function() {
		socket2.destroy();
	});
});
srv.listen(3001, function() {
	console.log("This \"client\" server now accepts input on :3001 (e.g. http://localhost:3001, ssh root@localhost -p 3001)");
});