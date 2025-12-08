module.exports = function (req, res, next) {
    if (!req.user || !req.user.is_admin_group) {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    next();
};
