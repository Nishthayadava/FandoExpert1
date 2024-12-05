const pool = require('../models/db');


const createUser = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        await pool.query('INSERT INTO users (name, role, password) VALUES ($1, $2, $3)', [username, role, password]);
        res.status(201).send('User created successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating user');
    }
};

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
const getUsers = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, role FROM users');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

module.exports = { getUserProfile,createUser,getUsers };
