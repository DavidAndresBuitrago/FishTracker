const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 1212;

// Determine database path based on environment
const isLocal = process.env.NODE_ENV !== 'production';
const dbPath = isLocal ? './fish.db' : '/opt/render/project/src/fish.db';

// Ensure the local database file exists or create it
if (isLocal && !fs.existsSync(dbPath)) {
    fs.closeSync(fs.openSync(dbPath, 'w')); // Create an empty file
    console.log('Created local database file:', dbPath);
}

// Set up SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
        process.exit(1); // Exit on failure
    }
    console.log('Connected to SQLite database.');
});

// Create table for fish data
db.run(`CREATE TABLE IF NOT EXISTS fish (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    species TEXT,
    size TEXT,
    weight TEXT,
    catchMethod TEXT,
    location TEXT,
    date TEXT,
    photoPath TEXT
)`);

// Set up file storage for photos
const uploadDir = isLocal ? './public/uploads/' : '/opt/render/project/src/public/uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory:', uploadDir);
}

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
app.use(express.json());

// Routes
app.get('/fish', (req, res) => {
    const userId = req.query.userId;
    let query = 'SELECT * FROM fish';
    let params = [];
    if (userId) {
        query += ' WHERE userId = ?';
        params = [userId];
    }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/fish', upload.single('photo'), (req, res) => {
    const { species, size, weight, catchMethod, location, date, userId } = req.body;
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    db.run(`INSERT INTO fish (userId, species, size, weight, catchMethod, location, date, photoPath) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, species, size, weight, catchMethod, location, date, photoPath],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Fish added successfully!' });
        }
    );
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});