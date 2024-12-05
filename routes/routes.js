const express = require('express');
const router = express.Router();
const { login } = require('./controllers/authController');
const { loginAttendance, logoutAttendance,handleBreak,applyLeave,getAdminAttendance } = require('../controllers/attendanceController');
const { getUserProfile,createUser  } = require('./controllers/userController');
const { updateLead } = require('./controllers/leadController');
const uploadController = require('../controllers/uploadController');
const multer = require('multer');

const authenticateToken = require('./middlewares/authMiddleware');

// Authentication Routes
router.post('/api/login', login); // User login

// Attendance Routes
router.post('/api/attendance/login', authenticateToken, loginAttendance);  // Attendance login
router.post('/api/attendance/logout', authenticateToken, logoutAttendance);  // Attendance logout
router.post('/api/attendance/break', authenticateToken, handleBreak);
// Apply leave route
router.post('/api/apply-leave', authenticateToken, applyLeave);
// Admin: Get all attendance records
router.get('/api/admin/attendance', authenticateToken, getAdminAttendance);


// User Routes
router.post('/api/users/create', createUser); // Create a new user
router.get('/api/getuserprofile/:userId', authenticateToken, getUserProfile);  // Fetch user profile

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



const upload = multer({ dest: 'uploads/' });
router.post('/uploadleads', upload.single('file'), uploadController.uploadLeads);

// Export the router
module.exports = router;
