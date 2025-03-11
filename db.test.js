const mysql = require('mysql2');
require('dotenv').config({path: './.env.test'});

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

db.connect((err) => {
    if (err) {
        console.error('Erreur lors de la connexion à la base de données: ' + err.stack);
        return process.exit(1);
    }

    console.log('Connexion à la base de données réussie !');
});

module.exports = db;
