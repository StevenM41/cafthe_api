const express = require("express");
const db = require("./db");
const bcrypt = require("bcrypt");
const verifyToken = require("./middleware");
const router = express.Router();
const {sign} = require("jsonwebtoken");
require("dotenv").config();


//Creation d'un utilisateur
router.post("/users/register", (req, res) => {
    const { user_name, user_prenom, user_email, user_password, user_telephone } = req.body;
    db.query("SELECT user_email FROM utilisateurs WHERE user_email = ?", [user_email], (err, result) => {
        if (err) return res.status(500).json({ message: "Erreur lors de l'enregistement de l'utilisateur"})
        if(result.length > 0) {return res.status(409).json({message: "L'adresse email est déja utiliser."});}
        bcrypt.hash(user_password, 10, (err, hash) => {
            if (err) return res.status(500).json( { message: "Erreur du hashage du mot de passe."})
            db.query("INSERT INTO utilisateurs (user_name, user_prenom, user_email, user_password, user_telephone) VALUES (?, ?, ?, ?, ?)",
                [user_name, user_prenom, user_email, hash, user_telephone], (err, result) => {
                if (err) {return res.status(500).json({message: "Erreur lors de l'inscription."})}

                const token = sign(
                    {id: result.insertId, email: user_email},
                    process.env.JWT_SECRET,
                )

                res.status(200).json({
                    message: "Utilisateur enregistrer",
                    token,
                    client: {
                        id: result.insertId,
                        nom: user_name,
                        prenom: user_prenom,
                    }
                })
            });
        })
    })
})

router.post("/users/login", (req, res) => {
    const {user_email, user_password} = req.body;

    db.query("SELECT * FROM utilisateurs WHERE user_email = ?", [user_email], (err, result) => {
        if(err) return res.status(500).json({ message: "Erreur serveur"})
        if(result.length === 0) {
            return res.status(401).json({ message: "Identifiant Incorrect" });
        }
        const user = result[0];

        bcrypt.compare(user_password, user.user_password, (err, isMatch) => {
            if(err) return res.status(500).json({message: "Erreur serveur"});
            if(!isMatch) return res.status(401).json({message: "Mot de passe Incorrect"});

            const token = sign(
                {id: user.user_id, email: user.user_email},
                process.env.JWT_SECRET,
            )

            res.status(200).json({
                message: "Connexion réussie",
                token,
                client: {
                    id: user.user_id,
                    nom: user.user_name,
                    prenom: user.user_prenom,
                }
            })
        })
    })
})

router.get('/users/:id', verifyToken, (req, res) => {
    const { id } = req.params;

    db.query('select * from utilisateurs where user_id = ?', [id], (err, result) => {
        if(err) return res.status(500).json({message: "Erreur lors d la récupération de l'utilisateur"});
        return res.status(200).json(result[0]);
    })
})

router.post("/users/edit", verifyToken, (req, res) => {
    const { user_id, user_name, user_prenom, user_email, user_password, user_telephone } = req.body;

})

// Création d'un achat
router.post("/achat/create", (req, res) => {
    const { achat_quantity, article_id } = req.body;

    db.query("SELECT article_stock, article_prix FROM Article WHERE article_id = ?", [article_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Erreur lors de la récupération de l'article." });
        if (results.length === 0) return res.status(404).json({ message: "Article non trouvé." });
        if (results[0].article_stock < achat_quantity) return res.status(406).json({ message: "Stock insuffisant.", stock_dispo: results[0].article_stock });

        db.query("INSERT INTO Achat (achat_quantity, achat_price, article_id) VALUES (?, ?, ?)", [achat_quantity, results[0].article_prix, article_id], (err, result) => {
            if (err) return res.status(500).json({ message: "Erreur lors de la création de l'achat." });

            res.status(201).json({
                message: "Achat effectué avec succès.",
                achat_id: result.insertId,
                price: results[0].article_prix,
                stock_restante: results[0].article_stock - achat_quantity
            });
        });
    });
});

// Création d'un panier
router.post("/panier/create", verifyToken, (req, res) => {
    const { user_id, achat_id } = req.body;

    if (!user_id || !achat_id) {
        return res.status(400).json({ message: "L'identifiant de l'utilisateur et de l'achat sont requis." });
    }
    db.query("SELECT * FROM utilisateurs WHERE user_id = ?", [user_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Erreur lors de la vérification de l'utilisateur." });
        if (results.length === 0) return res.status(404).json({ message: "Utilisateur non trouvé." });

        db.query("SELECT achat_quantity, achat_price FROM Achat WHERE achat_id = ?", [achat_id], (err, result) => {
            if (err) return res.status(500).json({ message: "Erreur lors de la vérification de l'achat." });
            if (result.length === 0) return res.status(404).json({ message: "Achat non trouvé." });

            const totale = result[0].achat_quantity * result[0].achat_price;

            db.query("INSERT INTO Panier (panier_totale, panier_cree, panier_statut, user_id, achat_id) VALUES (?, NOW(), ?, ?, ?)", [totale.toFixed(2), "actif", user_id, achat_id], (err, result) => {
                if (err) return res.status(500).json({ message: "Erreur lors de la création du panier." });

                res.status(201).json({
                    message: "Panier créé avec succès.",
                    panier_id: result.insertId,
                    user_id,
                    achat_id,
                    panier_totale: totale.toFixed(2),
                    panier_statut: "actif"
                });
            });
        });
    });
});

/**
 * ➤ ROUTE : Récupérer tous les articles
 */
router.get("/article", (req, res) => {
    db.query("SELECT * FROM article", (err, results) => {
        if (err) {
            console.error("Erreur lors de la récupération des articles :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }
        res.json(results);
    });
});
/**
 * ➤ ROUTE : Récupérer tous les articles en promotions
 */
router.get("/article/promotions/", (req, res) => {
    db.query("SELECT article.*, promotions.* FROM article JOIN article_promotions ON article.article_id = article_promotions.article_id JOIN promotions ON promotions.promotion_id = article_promotions.promotion_id;", (err, result) => {
        if(err) return res.status(500).json({ message: "Erreur du chargement des articles en promotions."})
        return res.status(200).json(result);
    })
})

router.get("/article/promotions/:id", (req, res) => {
    const { id } = req.params;
    db.query("SELECT article.*, promotions.* FROM article JOIN article_promotions ON article.article_id = article_promotions.article_id JOIN promotions ON promotions.promotion_id = article_promotions.promotion_id where article.article_id = ?",[id], (err, result) => {
        if(err) return res.status(500).json({ message: "Erreur du chargement des articles en promotions."})
        return res.status(200).json(result);
    })
})

/**
 * ➤ ROUTE : Récupérer tous les tags des articles.
 */
router.get("/article/tags/:id", (req, res) => {
    const { id } = req.params
    db.query("SELECT tags.* from article JOIN article_tags on article.article_id = article_tags.article_id JOIN tags on article_tags.tag_id = tags.tag_id WHERE article.article_id = ?;", [id], (err, result) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ message: "Erreur du chargement des tags." });
        }
        if (result.length === 0) {
            return res.status(404).json({ message: "Article non trouvé" });
        }
        return res.status(200).json(result);
    })
})

router.get("/article/categorie/:id", (req, res) => {
    const { id } = req.params;
    db.query("SELECT * FROM article WHERE categorie_id = ?;", [id], (err, result) => {
        if(err) return res.status(500).json({ message: "Erreur du chargement des catégories"});
        return res.status(200).json(result);
    })
})

/**
 * ➤ ROUTE : Récupérer un produit par son ID
 * ➤ URL : GET /api/article/ : id
 * ➤ Exemple d'utilisation : GET /api/article/1
 */
router.get("/article/:id", (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: "ID de l'article manquant" });
    }

    const articleId = parseInt(id, 10);
    if (isNaN(articleId) || articleId <= 0) {
        return res.status(400).json({ message: "ID de l'article invalide" });
    }

    // Requête à la base de données
    db.query("SELECT * FROM article WHERE article_id = ?", [articleId], (err, result) => {
        if (err) {
            console.error("Erreur de base de données:", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "Article non trouvé" });
        }

        res.json(result[0]);
    });
});

router.get("/tags", (req, res) => {
    db.query("SELECT * FROM tags", (err, result) => {
        if(err) return res.status(500).json({ message: "Erreur lors de la récuperation des tags."});
        return res.status(200).json(result);
    })
})

router.get("/tags/:id", (req, res) => {
    const { id } = req.params;
    db.query("SELECT * FROM tags where tag_id = ?",[id], (err, result) => {
        if(err) return res.status(500).json({ message: "Erreur lors de la récuperation des tags."});
        return res.status(200).json(result[0]);
    })
})

router.get('/filtre', (req, res) => {
    let query = `
        SELECT article.*, COUNT(DISTINCT tags.tag_id) as tag_count
        FROM article
                 JOIN article_tags ON article.article_id = article_tags.article_id
                 JOIN tags ON article_tags.tag_id = tags.tag_id
    `;

    let conditions = [];
    let values = [];
    let havingClause = "";

    // Vérifiez si `categorie_id` est 3 pour adapter les `JOIN`
    const categorieId = req.query.categorie_id ? parseInt(req.query.categorie_id, 10) : null;

    if (categorieId !== 3 && categorieId !== null) {
        query += `
        JOIN article_weight ON article.article_id = article_weight.article_id
        JOIN weight ON weight.weight_id = article_weight.weight_id
        JOIN article_boite ON article.article_id = article_boite.article_id
        JOIN boite ON boite.boite_id = article_boite.boite_id
        `;
    }

    // Ajouter une condition pour `categorie_id`
    if (categorieId) {
        conditions.push("article.categorie_id = ?");
        values.push(categorieId);
    }

    if (req.query.search) {
        conditions.push("article.article_name LIKE ?");
        values.push(`%${req.query.search}%`);
    }

    console.log("Search:", req.query.search);

    // Filtre par prix min et max
    if (req.query.price_min) {
        conditions.push("article.article_prix >= ?");
        values.push(req.query.price_min);
    }

    if (req.query.price_max) {
        conditions.push("article.article_prix <= ?");
        values.push(req.query.price_max);
    }

    console.log("Prix:", req.query.price_min, req.query.price_max);

    // Filtre par boîte
    if (req.query.boites && categorieId !== 3) {
        conditions.push("boite.boite_name = ?");
        values.push(req.query.boites);
    }

    // Filtre par poids
    if (req.query.weight && categorieId !== 3) {
        conditions.push("weight.weight_name = ?");
        values.push(req.query.weight);
    }

    // Filtre par tags
    if (req.query.tags) {
        let tags = req.query.tags;

        if (!Array.isArray(tags)) {
            tags = [tags];
        }

        tags = tags.map(tag => parseInt(tag, 10)).filter(tag => !isNaN(tag));

        if (tags.length > 0) {
            conditions.push(`tags.tag_id IN (${tags.map(() => "?").join(", ")})`);
            values.push(...tags);
        }
        if (tags.length > 1) {
            havingClause = `HAVING COUNT(DISTINCT tags.tag_id) = ${tags.length}`;
        }
    }

    // Ajouter les conditions WHERE si nécessaire
    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }

    query += " GROUP BY article.article_id";

    if (havingClause) {
        query += ` ${havingClause}`;
    }

    console.log(query, values);

    // Execution de la requête
    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ message: "Erreur lors du chargement des articles." });
        res.status(200).json(result);
    });
});

module.exports = router;

