const pool = require('../db');

// Get user profile
const getUserProfile = async (req, res) => {
    const { userId } = req.params;

    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.rows[0];
        const userProfile = {
            id: user.id,
            name: user.name,
            role: user.role,
        };

        res.status(200).json(userProfile);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Error fetching user profile', error });
    }
};

module.exports = { getUserProfile };
