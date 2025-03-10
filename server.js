const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({
        db: 'sessions.db', // Separate database for sessions
        dir: './'
    })
}));

// SQLite Databases
const db = new sqlite3.Database('fish.db');
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS catches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    fish_type TEXT,
    weight REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// Routes
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, 
        [username, hashedPassword], (err) => {
            if (err) return res.status(400).json({ error: 'Username taken' });
            res.json({ message: 'User created' });
        });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.session.userId = user.id;
        res.json({ message: 'Logged in', redirect: '/index.html' });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out', redirect: '/sign-in.html' });
});

app.get('/api/user', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    res.json({ loggedIn: true });
});

app.post('/api/change-password', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const { oldPassword, newPassword } = req.body;
    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.userId], async (err, user) => {
        if (err || !(await bcrypt.compare(oldPassword, user.password))) {
            return res.status(401).json({ error: 'Incorrect old password' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Password updated successfully' });
        });
    });
});

// New route to log a catch
app.post('/api/log-catch', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const { date, fishType, weight } = req.body;
    db.run(`INSERT INTO catches (user_id, date, fish_type, weight) VALUES (?, ?, ?, ?)`,
        [req.session.userId, date, fishType, weight], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to log catch' });
            res.json({ message: 'Catch logged successfully' });
        });
});

// New route to get catches for the logged-in user
app.get('/api/catches', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    db.all(`SELECT * FROM catches WHERE user_id = ?`, [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ catches: rows });
    });
});

app.listen(port, () => console.log(`Server running on port ${port}`));