const io = require("socket.io-client");
const net = require("net");
const duckcloud_api = "https://duckcloud.pcprojects.tk";
const vmId = -1;
const token = "";

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
	socket2.emit("tcp_vmselect", vmId, 22);
	socket2.on("datad", function(tcpBuf) {
		socket.write(Buffer.from(tcpBuf, "hex"));
	});
	socket2.on("disconnect", function() {
		socket.destroy();
	});
	socket.on("data", function(tcpBuf) {
		socket2.emit("datad", tcpBuf.toString("hex"));
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