const { getPool } = require('../config/db');


module.exports = {
async getGroup(groupId) {
const pool = await getPool();
const result = await pool.request()
.input('id', groupId)
.query(`SELECT * FROM groups WHERE id = @id`);
return result.recordset[0];
}
};