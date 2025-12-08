const userModel = require('../models/userModel');
const groupModel = require('../models/groupModel');


module.exports = {
async me(req, res) {
const group = await groupModel.getGroup(req.user.group_id);


res.json({
id: req.user.id,
username: req.user.username,
group: group.name,
is_group_admin: req.user.is_group_admin,
is_admin_group: req.user.is_admin_group
});
}
};