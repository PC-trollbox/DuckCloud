const objection = require("objection");
const knex = require("knex");
const readline = require("readline/promises");
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const db = {
	get: async function (item) {
		return (await User.query().where("name", item).withGraphFetched("_virtuals").limit(1))[0];
	},
	set: async function (item, content) {
        content._technicians = JSON.stringify(content.technicians || []) || "[]";
        content._isPRO = content.isPRO;
        content._disableSharing = content.disableSharing;
        content._cannotPRO = content.cannotPRO;
        content._blockEnumVM = content.blockEnumVM;
        content._blockLogin = content.blockLogin;
        content._block_ul = content.block_ul;
        delete content.technicians;
        delete content.isPRO;
        delete content.disableSharing;
        delete content.cannotPRO;
        delete content.blockEnumVM;
        delete content.blockLogin;
        delete content.block_ul;
        let virtuals = content.virtuals;
        delete content.virtuals;
		let count = await User.query().where("name", item).count();
        count = count[0]["count(*)"];
        if (count == 0) await User.query().insertGraph({
                name: item,
                ...content
            });
        else await User.query().where("name", item).update(content);
        let getId = (await db.get(item)).id;

		await VMEntry.query().where("user_id", getId).delete();
        for (let vm in virtuals) {
            virtuals[vm].user_id = getId;
            virtuals[vm].name = vm;
			virtuals[vm]._whitelist = JSON.stringify(virtuals[vm].whitelist || []) || "[]";
			virtuals[vm]._clickbased = virtuals[vm].clickbased;
			delete virtuals[vm].whitelist;
			delete virtuals[vm].clickbased;
            await VMEntry.query().insertGraph(virtuals[vm]);
		}
	},
	delete: async function (item) {
        await User.query().where("name", item).delete();
	},
	list: async function () {
		return (await User.query().select("name")).map(u => u.name);
	},
};

const knex_inited = knex({
    client: "sqlite3",
    useNullAsDefault: true,
    connection: {
        filename: "./cloud.sqlite3"
    }
});

const objectionModel = objection.Model;
objectionModel.knex(knex_inited);

class User extends objectionModel {
    #technicians = null;
    #isPRO = null;
    #disableSharing = null;
    #cannotPRO = null;
    #blockEnumVM = null;
    #blockLogin = null;
    #block_ul = null;
    #virtuals = null;
    static get tableName() {
        return "users";
    }

    static get relationMappings() {
        return {
            _virtuals: {
                relation: objectionModel.HasManyRelation,
                modelClass: VMEntry,
                join: {
                    from: "users.id",
                    to: "vms.user_id"
                }
            }
        }       
    }

    get technicians() {
        if (this.#technicians === null) this.#technicians = JSON.parse(this._technicians || "[]") || [];
        return this.#technicians;
    }

    set technicians(val) {
        if (this.#technicians === null) this.#technicians = JSON.parse(this._technicians || "[]") || [];
        this.#technicians = val;
    }

    get isPRO() {
        if (this.#isPRO === null) this.#isPRO = !!this._isPRO;
        return this.#isPRO;
    }

    set isPRO(val) {
        if (this.#isPRO === null) this.#isPRO = !!this._isPRO;
        this.#isPRO = val;
    }

    get disableSharing() {
        if (this.#disableSharing === null) this.#disableSharing = !!this._disableSharing;
        return this.#disableSharing;
    }

    set disableSharing(val) {
        if (this.#disableSharing === null) this.#disableSharing = !!this._disableSharing;
        this.#disableSharing = val;
    }

    get cannotPRO() {
        if (this.#cannotPRO === null) this.#cannotPRO = !!this._cannotPRO;
        return this.#cannotPRO;
    }

    set cannotPRO(val) {
        if (this.#cannotPRO === null) this.#cannotPRO = !!this._cannotPRO;
        this.#cannotPRO = val;
    }

    get blockEnumVM() {
        if (this.#blockEnumVM === null) this.#blockEnumVM = !!this._blockEnumVM;
        return this.#blockEnumVM;
    }

    set blockEnumVM(val) {
        if (this.#blockEnumVM === null) this.#blockEnumVM = !!this._blockEnumVM;
        this.#blockEnumVM = val;
    }

    get blockLogin() {
        if (this.#blockLogin === null) this.#blockLogin = !!this._blockLogin;
        return this.#blockLogin;
    }

    set blockLogin(val) {
        if (this.#blockLogin === null) this.#blockLogin = !!this._blockLogin;
        this.#blockLogin = val;
    }

    get block_ul() {
        if (this.#block_ul === null) this.#block_ul = !!this._block_ul;
        return this.#block_ul;
    }

    set block_ul(val) {
        if (this.#block_ul === null) this.#block_ul = !!this._block_ul;
        this.#block_ul = val;
    }

    get virtuals() {
        if (this.#virtuals === null) this.#virtuals = this.convertVirtuals(this._virtuals);
        return this.#virtuals;
    }

    set virtuals(val) {
        if (this.#virtuals === null) this.#virtuals = this.convertVirtuals(this._virtuals);
        this.#virtuals = val;
    }

    convertVirtuals(obj) {
        let virtualsList = {};
        for (let virtual of obj) {
            let name = virtual.name;
            delete virtual.name;
            virtualsList[name] = virtual;
        }
        return virtualsList;
    }
}

class VMEntry extends objectionModel {
    static get tableName() {
        return "vms";
    }

	#whitelist = null;
	#clickbased = null;

    get whitelist() {
		console.log("OMFG WHITELIST GET");
		if (this.#whitelist === null) this.#whitelist = JSON.parse(this._whitelist || "[]") || [];
		console.log("WHITELIST IS FUCKING", this.#whitelist);
        return this.#whitelist;
    }

	set whitelist(val) {
		console.log("OMFG WHITELIST SET TO ", val);
		if (this.#whitelist === null) this.#whitelist = JSON.parse(this._whitelist || "[]") || [];
		this.#whitelist = val;
		console.log("WHITELIST IS FUCKING", this.#whitelist, "NOW");
	}

    get clickbased() {
		console.log("OMFG CLICKBASED GET");
		if (this.#clickbased === null) this.#clickbased = !!this._clickbased;
		console.log("CLICKBASED IS FUCKING", this.#clickbased);
        return this.#clickbased;
    }

	set clickbased(val) {
		console.log("OMFG CLICKBASED SET TO ", val);
		if (this.#clickbased === null) this.#clickbased = !!this._clickbased;
		this.#clickbased = val;
		console.log("CLICKBASED IS FUCKING", this.#clickbased, "NOW");
	}
}

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
}

function vmsFn(table) {
    table.string("id").primary();
    table.string("name");
    table.boolean("_clickbased");
    table.string("_whitelist");
    table.integer("user_id").references("id").inTable("users");
}

(async function Main() {
    console.log("Creating schemas...");
    await createSchema("users", usersFn);
    console.log("Created schema users");
    await createSchema("vms", vmsFn);
    console.log("Created schema vms");
	console.log("The minimal shell for recovery is ready.");
	console.log("Use JavaScript expressions to interact with the database. Everything will be synchronized as soon as possible, but please wait a few seconds before exiting.");
	console.log("Then use `process.exit(0)` to leave this shell.");
	while (true) {
		let cmd = await rl.question("# ");
		try {
			console.log(eval(cmd));
		} catch (e) {
			console.error(e);
		}
	}
})();