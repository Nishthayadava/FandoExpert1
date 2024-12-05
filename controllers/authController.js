const pool = require('../models/db');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
    const { id, role } = user;
    return jwt.sign({ id: id.trim(), role: role.trim() }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const generateRefreshToken = (user) => {
    const { id, role } = user;
    return jwt.sign({ id: id.trim(), role: role.trim() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

const login = async (req, res) => {
    let { username, password } = req.body;
      username = username.trim();
    password = password.trim();
    try {
        const userQuery = await pool.query('SELECT * FROM users WHERE name = $1 AND password=$2', [username, password]);
        if (userQuery.rows.length > 0) {
            const user = userQuery.rows[0];
            const token = generateToken(user);
            return res.json({ token, role: user.role, userId: user.id });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { login };
