const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = 80;

app.use(express.static('public'));
app.use(express.json());

let connection = null;

async function getConnection() {
    if (!connection) {
        connection = await mysql.createConnection({
            host: "student-databases.cvode4s4cwrc.us-west-2.rds.amazonaws.com",
            user: "TREVORWHITT77",
            password: "vlQS83fdH8KGcKSs2Hn7pa15Z3VyUJghoO7",
            database: "TREVORWHITT77"
        });
    }
    return connection;
}

async function query(sql, params) {
    const conn = await getConnection();
    return (await conn.execute(sql, params))[0];
}

app.get('/cards', async (req, res) => {
    try {
        const {
            set_ip,
            set_id,
            card_name,
            card_rarity,
            is_hit,
            card_artist_name,
            release_date_year
        } = req.query;

        let sql = `
            SELECT 
                c.id,
                c.set_id,
                c.card_name,
                c.card_rarity,
                c.is_hit,
                c.card_artist_name,
                s.set_ip,
                s.release_date_year
            FROM cards c
            INNER JOIN set_names s ON c.set_id = s.set_id
        `;

        const conditions = [];
        const params = [];

        if (set_ip) {
            conditions.push(`s.set_ip = ?`);
            params.push(set_ip);
        }

        if (set_id) {
            conditions.push(`c.set_id LIKE ?`);
            params.push(`%${set_id}%`);
        }

        if (card_name) {
            conditions.push(`c.card_name LIKE ?`);
            params.push(`%${card_name}%`);
        }

        if (card_rarity) {
            conditions.push(`c.card_rarity = ?`);
            params.push(card_rarity);
        }

        if (is_hit !== undefined) {
            conditions.push(`c.is_hit = ?`);
            params.push(is_hit);
        }

        if (card_artist_name) {
            conditions.push(`c.card_artist_name LIKE ?`);
            params.push(`%${card_artist_name}%`);
        }

        if (release_date_year) {
            conditions.push(`s.release_date_year = ?`);
            params.push(release_date_year);
        }

        // Add WHERE only if conditions exist
        if (conditions.length) {
            sql += ` WHERE ` + conditions.join(" AND ");
        }

        sql += ` LIMIT 100`;

        const result = await query(sql, params);

        res.json({ data: result });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/cards/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const result = await query(`
            SELECT 
                c.id,
                c.set_id,
                c.card_name,
                c.card_rarity,
                c.is_hit,
                c.card_artist_name,
                s.set_ip,
                s.release_date_year
            FROM cards c
            INNER JOIN set_names s ON c.set_id = s.set_id
            WHERE c.id = ?
        `, [id]);

        if (!result.length) {
            return res.status(404).json({ error: "Card not found" });
        }

        res.json({ data: result[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/cards', async (req, res) => {
    const conn = await getConnection();

    try {
        const {
            set_ip,
            set_id,
            card_name,
            card_rarity,
            is_hit,
            card_artist_name,
            release_date_year
        } = req.body;

        const allowedIPs = ["Pokemon", "Magic: The Gathering", "Riftbound"];

        const errors = [];

        if (!set_ip || !allowedIPs.includes(set_ip.trim())) {
            errors.push("Invalid set IP");
        }

        if (!set_id) errors.push("Set ID required");
        if (!card_name) errors.push("Card name required");
        if (!card_rarity) errors.push("Card rarity required");
        if (!card_artist_name) errors.push("Artist name required");

        const year = Number(release_date_year);
        if (isNaN(year)) errors.push("Invalid release year");

        if (is_hit !== 0 && is_hit !== 1) {
            errors.push("is_hit must be 0 or 1");
        }

        if (errors.length) {
            return res.status(400).json({ errors });
        }

        await conn.beginTransaction();

        await conn.execute(`
            INSERT INTO set_names (set_id, set_ip, release_date_year)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                set_ip = VALUES(set_ip),
                release_date_year = VALUES(release_date_year)
        `, [set_id, set_ip, year]);

        await conn.execute(`
            INSERT INTO cards 
            (set_id, card_name, card_rarity, is_hit, card_artist_name)
            VALUES (?, ?, ?, ?, ?)
        `, [
            set_id,
            card_name,
            card_rarity,
            is_hit,
            card_artist_name
        ]);

        await conn.commit();

        res.json({ data: { message: "Card inserted successfully" } });

    } catch (err) {
        await conn.rollback();

        console.error(err);

        res.status(500).json({ error: "Insert failed" });
    }
});

app.put('/cards/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const {
            set_id,
            card_name,
            rarity,
            is_hit,
            artist_name
        } = req.body;

        await query(`
            UPDATE cards
            SET set_id = ?,
                card_name = ?,
                card_rarity = ?,
                is_hit = ?,
                card_artist_name = ?
            WHERE id = ?
        `, [
            set_id,
            card_name,
            rarity,
            is_hit,
            artist_name,
            id
        ]);

        res.json({ data: { message: "Updated successfully" } });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

app.listen(port, () => {
    console.log(`Running on http://localhost:${port}`);
});