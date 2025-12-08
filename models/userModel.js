const { getPool } = require('../config/db');


module.exports = {
async findByUsername(username) {
const pool = await getPool();
const result = await pool.request()
.input('username', username)
.query(`SELECT * FROM users WHERE username = @username`);
return result.recordset[0];
},


async create(username, password_hash, group_id) {
const pool = await getPool();
await pool.request()
.input('username', username)
.input('password_hash', password_hash)
.input('group_id', group_id)
.query(`INSERT INTO users (username, password_hash, group_id) VALUES (@username, @password_hash, @group_id)`);
},

async createUser(username, password_hash, group_id, is_group_admin = 0) {
    const pool = await getPool();
    await pool.request()
        .input('username', username)
        .input('password_hash', password_hash)
        .input('group_id', group_id)
        .input('is_group_admin', is_group_admin)
        .query(`
            INSERT INTO users (username, password_hash, group_id, is_group_admin)
            VALUES (@username, @password_hash, @group_id, @is_group_admin)
        `);
},

async getGroups(userGroupId) {
    const pool = await getPool();
    const result = await pool.request()
        .input('group_id', userGroupId)
        .query(`SELECT id, name FROM groups WHERE id <> @group_id ORDER BY name`);
    return result.recordset;
}



};

