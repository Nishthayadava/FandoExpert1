const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');
const { loginAttendance, logoutAttendance,handleBreak,applyLeave,getAdminAttendance,getAttendance } = require('../controllers/attendanceController');
const { getUserProfile,createUser,getUsers  } = require('../controllers/userController');
const { getLeads,updateLead,assignAgent ,getMyLeads,updateLeadStatus} = require('../controllers/leadController');
const uploadController = require('../controllers/uploadController');
const multer = require('multer');

const {authenticateToken,refreshToken,generateToken} = require('../middlewares/authMiddleware');

// Authentication Routes
router.post('/api/login', login); // User login
router.post('/api/refresh-token', refreshToken);


// Attendance Routes
router.post('/api/attendance/login', authenticateToken, loginAttendance);  // Attendance login
router.post('/api/attendance/logout', authenticateToken, logoutAttendance);  // Attendance logout
router.post('/api/attendance/break', authenticateToken, handleBreak);
// Apply leave route
router.post('/api/apply-leave', authenticateToken, applyLeave);
// Admin: Get all attendance records
router.get('/api/admin/attendance', authenticateToken, getAdminAttendance);
router.get('/api/attendance/:userId', getAttendance);


// User Routes
router.post('/api/create-user', createUser); // Create a new user
router.get('/api/getuserprofile/:userId', authenticateToken, getUserProfile);  // Fetch user profile

// Lead Routes
router.put('/api/updatelead/:id', authenticateToken, updateLead); // Update lead information
router.get('/api/getleads', getLeads);
// Assign agent to leads
router.post('/api/assignagent',authenticateToken, assignAgent);
router.get('/my-leads', authenticateToken, getMyLeads);
router.patch('/update-lead-status', authenticateToken, updateLeadStatus);


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
router.get('/get-users', getUsers);

// Export the router
module.exports = router;
