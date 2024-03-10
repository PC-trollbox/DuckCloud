const dockerode = require("dockerode");
const db_setup = require("./db");
const docker = new dockerode();
const db = db_setup("users");
const db_virtuals = db_setup("virtuals");

module.exports = {
    name: "duckcloud_http_hostmatch",
    features: ["hostmatch"],
    runHostMatch: async function(host) {
        let duckcloudVmId = host.split(".")[0];
        if (!duckcloudVmId.startsWith("duckcloud-")) return null;
        duckcloudVmId = duckcloudVmId.replace("duckcloud-", "");
        let container = await docker.getContainer(duckcloudVmId);
        let inspected = await container.inspect();
        let duckcloudVmInfo = await db_virtuals.get(inspected.Id);
        duckcloudVmInfo = (await db.get(duckcloudVmInfo.username)).virtuals[duckcloudVmInfo.vmname];
        if (!duckcloudVmInfo.clickbased) throw new Error("Click-based access disabled");
        return "http://" + inspected.NetworkSettings.IPAddress;
    }
}