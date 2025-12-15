const { getPool } = require('../config/db');


module.exports = {
async getGroup(groupId) {
const pool = await getPool();
const result = await pool.request()
.input('id', groupId)
.query(`SELECT [id]
      ,[name]
      ,[is_admin_group]
      ,[created_at]
      ,isnull([is_system_admin], 0) AS is_system_admin FROM groups WHERE id = @id`);
console.log(result.recordset[0]);
return result.recordset[0];
}
};