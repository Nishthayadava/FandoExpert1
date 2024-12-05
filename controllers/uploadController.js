const fs = require('fs');
const csvParser = require('csv-parser');
const pool = require('../db'); // Make sure to import the pool connection
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

const uploadLeads = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const client = await pool.connect();
        for (const lead of results) {
          const { name, email, phone_number, address } = lead;
          await client.query('INSERT INTO customers (name, email, phone_number, address) VALUES ($1, $2, $3, $4)', [name, email, phone_number, address]);
        }
        client.release();
        res.status(200).json({ message: 'Leads uploaded successfully.' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error uploading leads', error: error.message });
      }
    });
};

module.exports = {
  uploadLeads,
};
