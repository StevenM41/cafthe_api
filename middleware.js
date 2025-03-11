const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({ message: "Token manquant" });
    }

    const tokenParts = authHeader.split(" ");
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
        return res.status(401).json({ message: "Format de token invalide" });
    }

    const tokenValue = tokenParts[1];

    jwt.verify(tokenValue, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error("Erreur de vérification du token :", err.message);
            return res.status(401).json({ message: "Token invalide" });
        }
        req.user = decoded;
        next();
    });
};

module.exports = { verifyToken };
