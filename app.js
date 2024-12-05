const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('./dotenv');
const routes = require('./routes/routes'); // Import the consolidated routes

// Initialize app
const app = express();
dotenv.config();  // Load environment variables

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Use the routes from the consolidated routes file
app.use(routes);

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
