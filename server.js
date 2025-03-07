const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');

const app = express();
const port = 9999;

// Set up SQLite database with Render's persistent disk path
const db = new sqlite3.Database('/opt/render/project/src/fish.db', (err) => {
    if (err) console.error(err.message);
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

// Set up file storage for photos with Render's persistent disk path
const storage = multer.diskStorage({
    destination: '/opt/render/project/src/public/uploads/',
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