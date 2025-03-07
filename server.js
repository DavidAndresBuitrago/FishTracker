const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 1212;

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Determine database path based on environment
const isLocal = process.env.NODE_ENV !== 'production';
const dbPath = isLocal ? './fish.db' : '/opt/render/project/src/fish.db';

// Ensure the database file exists or create it
if (!fs.existsSync(dbPath)) {
    try {
        fs.closeSync(fs.openSync(dbPath, 'w')); // Create an empty file
        console.log('Created database file:', dbPath);
    } catch (err) {
        console.error('Failed to create database file:', err.message);
        process.exit(1);
    }
} else {
    console.log('Database file exists:', dbPath);
}

// Set up SQLite database with verbose error handling
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database at:', dbPath);
});

// Recreate table to ensure correct schema (drops and recreates if it exists)
db.serialize(() => {
    db.run('DROP TABLE IF EXISTS fish', (err) => {
        if (err) console.error('Failed to drop table:', err.message);
        else console.log('Dropped fish table if it existed.');
    });

    db.run(`CREATE TABLE fish (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        species TEXT,
        size TEXT,
        weight TEXT,
        catchMethod TEXT,
        location TEXT,
        date TEXT,
        photoPath TEXT
    )`, (err) => {
        if (err) {
            console.error('Table creation error:', err.message);
        } else {
            console.log('Fish table created or verified.');
        }
    });
});

// Set up file storage for photos with robust directory creation
const uploadDir = isLocal ? './public/uploads/' : '/opt/render/project/src/public/uploads/';
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('Created uploads directory:', uploadDir);
    } catch (err) {
        console.error('Failed to create uploads directory:', err.message);
    }
} else {
    console.log('Uploads directory exists:', uploadDir);
}

// Verify write permissions for the upload directory
try {
    fs.accessSync(uploadDir, fs.constants.W_OK);
    console.log('Uploads directory is writable.');
} catch (err) {
    console.error('Uploads directory is not writable:', err.message);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

// CSP header as fallback
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-eval' https://www.gstatic.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    );
    next();
});

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
        if (err) {
            console.error('GET /fish error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

app.post('/fish', upload.single('photo'), (req, res) => {
    console.log('POST /fish - Received body:', req.body);
    console.log('POST /fish - Received file:', req.file);
    const { species, size, weight, catchMethod, location, date, userId } = req.body;
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!userId) {
        console.log('POST /fish - Missing userId');
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (!species || !size || !weight || !catchMethod || !location || !date) {
        console.log('POST /fish - Missing required fields');
        return res.status(400).json({ error: 'All fields (species, size, weight, catchMethod, location, date) are required' });
    }

    db.run(`INSERT INTO fish (userId, species, size, weight, catchMethod, location, date, photoPath) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, species, size, weight, catchMethod, location, date, photoPath],
        (err) => {
            if (err) {
                console.error('POST /fish - Database error:', err.message);
                return res.status(500).json({ error: 'Failed to add fish: ' + err.message });
            }
            console.log('POST /fish - Fish added successfully for user:', userId);
            res.json({ message: 'Fish added successfully!' });
        }
    );
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});