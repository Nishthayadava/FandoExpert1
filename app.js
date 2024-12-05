const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('./config/dotenv');
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const userRoutes = require('./routes/userRoutes');
const leadRoutes = require('./routes/leadRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Initialize app
const app = express();
dotenv.config();  // Load environment variables

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/admin', adminRoutes);

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
