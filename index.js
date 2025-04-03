const express = require("express");
const cors = require("cors");
const routes = require("./endpoints");

const app = express();
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000", "https://cafthe.steven.mallochet.v70208.dev-campus.fr"],
    methods: ["GET","POST","PUT","DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use("/api", routes);

app.listen(3001, () => {
    console.log(`L'API est démarrée et accessible`);
});

