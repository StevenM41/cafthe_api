const express = require("express");
const db = require("./db");
const bcrypt = require("bcrypt");
const {verifyToken} = require("./middleware");
const router = express.Router();
const {sign} = require("jsonwebtoken");
require("dotenv").config();

function ERROR_500(res) {
    return res.status(500).json({ message: "Erreur 500" });
}

//Creation d'un utilisateur
router.post("/users/register", (req, res) => {
    const { user_name, user_prenom, user_email, user_password, user_telephone } = req.body;
    db.query("SELECT user_email FROM utilisateurs WHERE user_email = ?", [user_email], (err, result) => {
        if (err) return ERROR_500(res);
        if(result.length > 0) {return res.status(409).json({message: "L'adresse email est déja utiliser."});}
        bcrypt.hash(user_password, 10, (err, hash) => {
            if (err) return res.status(500).json( { message: "Erreur du hashage du mot de passe."})
            db.query("INSERT INTO utilisateurs (user_name, user_prenom, user_email, user_password, user_telephone) VALUES (?, ?, ?, ?, ?)", [user_name, user_prenom, user_email, hash, user_telephone], (err, result) => {
                if (err) {return res.status(500).json({message: "Erreur lors de l'inscription."})}
                return res.status(200).json({message: "Utilisateur enregistrer", user_id: result.insertId});
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
                {expiresIn: process.env.JTW_EXPIRES_IN, }
            )

            res.status(200).json({
                message: "Connexion réussie",
                token,
                client: {
                    id: user.user_id,
                    nom: user.user_name,
                    prenom: user.user_prenom,
                    profile: user.profile_img,
                    role: "admin"
                }
            })
        })
    })
})


//Creation d'un avis
router.post('/users/avis/create', (req, res) => {
    const { avis_note, avis_coms, article_id, user_id } = req.body
    if(avis_note < 0 || avis_note > 5) {return res.status(400).json({message: "La note doit être entre 0 et 5."})}
    db.query("INSERT INTO avis (avis_note, avis_coms, avis_creer, article_id, user_id) VALUES (?, ?, CURRENT_TIMESTAMP, ? , ?)", [avis_note, avis_coms, article_id, user_id], (err, result) => {
        if(err) return res.status(500).json({ message: "L'importation des donnés de l'avis ont échouer.", result: err})
        if(result) return res.status(202).json({ message: "L'importation des donnés de l'avis ont bien étais ajouté."})
    })
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
router.post("/panier/create", (req, res) => {
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
        return res.status(200).json();
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

router.get("/article/categorie/count/:id", (req, res) => {
    const { id } = req.params;
    db.query("SELECT COUNT(article.article_id) AS ID FROM article WHERE categorie_id = 1;", [id], (err, result) => {
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

    // Vérification 1: S'assurer que l'ID est fourni
    if (!id) {
        return res.status(400).json({ message: "ID de l'article manquant" });
    }

    // Vérification 2: S'assurer que l'ID est un nombre entier positif
    const articleId = parseInt(id, 10);
    if (isNaN(articleId) || articleId <= 0) {
        return res.status(400).json({ message: "ID de l'article invalide" });
    }

    // Requête à la base de données
    db.query("SELECT * FROM article WHERE article_id = ?", [articleId], (err, result) => {
        // Vérification 3: Gérer les erreurs de base de données
        if (err) {
            console.error("Erreur de base de données:", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }

        // Vérification 4: Vérifier si l'article existe
        if (result.length === 0) {
            return res.status(404).json({ message: "Article non trouvé" });
        }

        // Retourner l'article trouvé
        res.json(result[0]);
    });
});


router.get("/search/:article_name", (req, res) => {
    const { article_name } = req.params;

    // Vérifiez si article_name est vide ou non défini
    if (!article_name) {
        return res.status(400).json({ message: "article_name cannot be null or empty" });
    }

    db.query("SELECT * FROM article WHERE article_name LIKE ?", [`%${article_name}%`], (err, result) => {
        if (err) {
            return res.status(500).json({ message: "Error searching for article by name." });
        }
        return res.status(200).json(result);
    });
});

module.exports = router;