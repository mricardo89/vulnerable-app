require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // Importamos 'Pool' desde 'pg'
const app = express();

// --- Configuración ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const DB_URI = process.env.DB_URI;

if (!DB_URI) {
    throw new Error("No se encontró la DB_URI. Asegúrate de crear tu archivo .env");
}

// Conexión a la BD (PostgreSQL)
// 'pg' usa un Pool y lee la cadena de conexión así:
const pool = new Pool({
    connectionString: DB_URI,
});

// --- Rutas ---
app.get('/', (req, res) => {
    res.redirect('/muro');
});

// --- VULNERABILIDAD XSS (GET /muro) ---
app.get('/muro', async (req, res) => {
    try {
        // En 'pg', los resultados están en la propiedad 'rows'
        const { rows } = await pool.query("SELECT * FROM comentarios ORDER BY id DESC LIMIT 10");
        res.render('muro', { comentarios: rows });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// --- VULNERABILIDAD XSS (POST /comentar) ---
app.post('/comentar', async (req, res) => {
    const { autor, mensaje } = req.body;
    try {
        // ¡VULNERABILIDAD! Usamos plantillas de string para insertar datos
        // Esto permite XSS y también Inyección SQL en los comentarios
        const sql = `INSERT INTO comentarios (autor, mensaje) VALUES ('${autor}', '${mensaje}')`;
        await pool.query(sql);
        res.redirect('/muro');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// --- VULNERABILIDAD SQLi (GET /login) ---
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// --- VULNERABILIDAD SQLi (POST /login) ---
app.post('/login', async (req, res) => {
    const { user, pass } = req.body;

    // ¡¡¡VULNERABILIDAD DE INYECCIÓN SQL!!!
    // Construimos la consulta concatenando strings.
    // Usamos comillas dobles para los nombres de columnas ("user", "pass")
    const sql = `SELECT * FROM usuarios WHERE "user" = '${user}' AND "pass" = '${pass}'`;
    
    console.log("Ejecutando SQL inseguro:", sql);

    try {
        const result = await pool.query(sql);

        // En 'pg', los resultados están en 'result.rows'
        if (result.rows.length > 0) {
            res.send(`<h1>Bienvenido, ${result.rows[0].user}!</h1><p>Has iniciado sesión (de forma insegura).</p><a href="/muro">Ir al Muro</a>`);
        } else {
            res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
    } catch (error) {
        res.render('login', { error: error.message });
    }
});

// Escuchar en 0.0.0.0 es necesario para Render
app.listen(PORT, '0.0.0.0', () => { 
    console.log(`Servidor vulnerable (Supabase) escuchando en el puerto ${PORT}`);
});