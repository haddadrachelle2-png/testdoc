const bcrypt = require("bcryptjs");
const userModel = require("../models/userModel");

module.exports = {
    async register(req, res) {
        const { username, password, group_id, is_group_admin } = req.body;

        if (!username || !password || !group_id)
            return res.status(400).json({ message: "Missing fields." });

        const existing = await userModel.findByUsername(username);
        if (existing)
            return res.status(400).json({ message: "Username already taken." });

        const hash = await bcrypt.hash(password, 10);

        await userModel.createUser(username, hash, group_id, is_group_admin ? 1 : 0);

        res.json({ message: "User registered successfully." });
    },

    async listGroups(req, res) {
        const groups = await userModel.getGroups(req.user.group_id);
        res.json(groups);
    }
};
