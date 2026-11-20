const db = require('../../src/persistence');
const getLongestItem = require('../../src/routes/getLongestItem');

jest.mock('../../src/persistence', () => ({
    getItems: jest.fn(),
}));

const ITEMS = [
    { id: 1, name: 'Tache' },
    { id: 2, name: 'Faire les courses' },
    { id: 3, name: 'Apprendre JavaScript' },
];

// 1. Renvoie la tâche dont le nom est le plus long
test('renvoie la tâche avec le nom le plus long', async () => {
    const req = {};
    const res = { send: jest.fn() };

    db.getItems.mockResolvedValue(ITEMS);

    await getLongestItem(req, res);

    expect(res.send).toHaveBeenCalledWith(ITEMS[2]);
});

// 2. En cas d'égalité, renvoie la première tâche
test('renvoie la première tâche en cas d égalité', async () => {
    const req = {};
    const res = { send: jest.fn() };

    const items = [
        { id: 1, name: 'Bonjour' },
        { id: 2, name: 'Comment' },
    ];

    db.getItems.mockResolvedValue(items);

    await getLongestItem(req, res);

    expect(res.send).toHaveBeenCalledWith(items[0]);
});

// 3. Une liste vide renvoie le code HTTP 404
test('renvoie une erreur 404 si la liste est vide', async () => {
    const req = {};
    const res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
    };

    db.getItems.mockResolvedValue([]);

    await getLongestItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
});