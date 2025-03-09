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
    }
} else {
    console.log('Database file exists:', dbPath);
}

// Set up SQLite database with verbose error handling
let db;
try {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Failed to connect to SQLite database:', err.message);
            throw err;
        }
        console.log('Connected to SQLite database at:', dbPath);
    });
} catch (err) {
    console.error('Database initialization failed, proceeding without database:', err.message);
    db = null;
}

// Recreate tables to ensure correct schema
if (db) {
    try {
        db.serialize(() => {
            // Drop existing tables
            db.run('DROP TABLE IF EXISTS fish', (err) => {
                if (err) console.error('Failed to drop fish table:', err.message);
                else console.log('Dropped fish table if it existed.');
            });
            db.run('DROP TABLE IF EXISTS folders', (err) => {
                if (err) console.error('Failed to drop folders table:', err.message);
                else console.log('Dropped folders table if it existed.');
            });

            // Create folders table
            db.run(`CREATE TABLE folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                name TEXT NOT NULL
            )`, (err) => {
                if (err) console.error('Folders table creation error:', err.message);
                else console.log('Folders table created.');
            });

            // Create fish table with folderId
            db.run(`CREATE TABLE fish (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                species TEXT,
                size TEXT,
                weight TEXT,
                catchMethod TEXT,
                location TEXT,
                date TEXT,
                photoPath TEXT,
                folderId INTEGER,
                FOREIGN KEY (folderId) REFERENCES folders(id)
            )`, (err) => {
                if (err) console.error('Fish table creation error:', err.message);
                else console.log('Fish table created or verified.');
            });
        });
    } catch (err) {
        console.error('Table recreation failed:', err.message);
    }
}

// Set up file storage for photos
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
const upload = multer({ storage: storage || { destination: '/tmp/' } });

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

// Routes with database fallback
app.get('/fish', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const userId = req.query.userId;
    const folderId = req.query.folderId;
    let query = 'SELECT * FROM fish WHERE userId = ?';
    let params = [userId];
    if (folderId) {
        query += ' AND folderId = ?';
        params.push(folderId);
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
    if (!db) return res.status(500).json({ error: 'Database not available' });
    console.log('POST /fish - Received body:', req.body);
    console.log('POST /fish - Received file:', req.file);
    const { species, size, weight, catchMethod, location, date, userId, folderId } = req.body;
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!userId) {
        console.log('POST /fish - Missing userId');
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (!species || !size || !weight || !catchMethod || !location || !date) {
        console.log('POST /fish - Missing required fields');
        return res.status(400).json({ error: 'All fields (species, size, weight, catchMethod, location, date) are required' });
    }

    db.run(`INSERT INTO fish (userId, species, size, weight, catchMethod, location, date, photoPath, folderId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, species, size, weight, catchMethod, location, date, photoPath, folderId || null],
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

app.delete('/fish/:id', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const fishId = req.params.id;
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    db.get('SELECT userId FROM fish WHERE id = ?', [fishId], (err, row) => {
        if (err) {
            console.error('DELETE /fish - Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Fish entry not found' });
        }
        if (row.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this entry' });
        }

        db.run('DELETE FROM fish WHERE id = ?', [fishId], (err) => {
            if (err) {
                console.error('DELETE /fish - Database error:', err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Fish deleted successfully!' });
        });
    });
});

app.get('/folders', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    db.all('SELECT * FROM folders WHERE userId = ?', [userId], (err, rows) => {
        if (err) {
            console.error('GET /folders error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

app.post('/folder', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const { userId, name } = req.body;
    if (!userId || !name) {
        return res.status(400).json({ error: 'User ID and folder name are required' });
    }
    db.run('INSERT INTO folders (userId, name) VALUES (?, ?)', [userId, name], (err) => {
        if (err) {
            console.error('POST /folder - Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Folder created successfully!' });
    });
});

app.delete('/folder/:id', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const folderId = req.params.id;
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    db.get('SELECT userId FROM folders WHERE id = ?', [folderId], (err, row) => {
        if (err) {
            console.error('DELETE /folder - Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        if (row.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this folder' });
        }

        // Delete folder and update fish entries
        db.run('UPDATE fish SET folderId = NULL WHERE folderId = ?', [folderId], (err) => {
            if (err) {
                console.error('DELETE /folder - Update fish error:', err.message);
                return res.status(500).json({ error: err.message });
            }
            db.run('DELETE FROM folders WHERE id = ?', [folderId], (err) => {
                if (err) {
                    console.error('DELETE /folder - Database error:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ message: 'Folder deleted successfully!' });
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});