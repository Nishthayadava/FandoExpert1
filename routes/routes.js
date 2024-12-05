const express = require('express');
const router = express.Router();
const { login } = require('./controllers/authController');
const { loginAttendance } = require('./controllers/attendanceController');
const { createUser } = require('./controllers/userController');
const { updateLead } = require('./controllers/leadController');
const authenticateToken = require('./middlewares/authMiddleware');

// Authentication Routes
router.post('/api/login', login); // User login

// Attendance Routes
router.post('/api/attendance/login', authenticateToken, loginAttendance); // Mark attendance login

// User Routes
router.post('/api/users/create', createUser); // Create a new user

// Lead Routes
router.put('/api/leads/updatelead/:id', authenticateToken, updateLead); // Update lead information

// Admin Routes (Example: Fetch all attendance records for admin)
router.get('/api/admin/attendance', authenticateToken, async (req, res) => {
    // Example logic to retrieve all attendance records (can be expanded as needed)
    try {
        // Example code to fetch all attendance data (replace with actual DB logic)
        const attendanceData = []; // Example data
        res.status(200).json({ attendanceData });
    } catch (error) {
        console.error('Error fetching attendance data:', error);
        res.status(500).json({ message: 'Error fetching attendance data.' });
    }
});

// Export the router
module.exports = router;
