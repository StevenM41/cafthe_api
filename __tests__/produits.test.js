const request = require('supertest');
const express = require('express');
const routeModule = require('../endpoints');

const db = require('../db.test');

const app = express();
app.use(express.json());
app.use('/api', routeModule);

describe('Endpoints pour les produits', () => {
    test('GET /api/article - Retourne tout les articles.', async () => {
        const response = await request(app).get('/api/article');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
    });

    test('GET /api/article/:id - Retourne un article par id.', async () => {
        const id = 21;
        const response = await request(app).get(`/api/article/${id}`);
        expect(response.status).toBe(200);
        expect(typeof response.body).toBe('object'); // Vérifie que c'est un objet
        expect(response.body).toHaveProperty('article_id', id); // Vérifie que l'article a l'ID correct
    });
});