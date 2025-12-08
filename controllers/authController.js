const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const groupModel = require('../models/groupModel');
require('dotenv').config();


module.exports = {
async login(req, res) {
const { username, password } = req.body;


const user = await userModel.findByUsername(username);
if (!user) return res.status(400).json({ message: 'User not found' });


const isValid = await bcrypt.compare(password, user.password_hash);
if (!isValid) return res.status(400).json({ message: 'Wrong password' });


const group = await groupModel.getGroup(user.group_id);


const token = jwt.sign(
{
id: user.id,
username: user.username,
group_id: user.group_id,
is_group_admin: user.is_group_admin,
is_admin_group: group.is_admin_group
},
process.env.JWT_SECRET,
{ expiresIn: '8h' }
);


res.json({ token });
}
};