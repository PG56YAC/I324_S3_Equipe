// Duplique une tâche existante
// avec un nouveau id
const db = require('../persistence');
const { v4: uuid } = require('uuid');
const defaults = require('../defaults');

module.exports = async (req, res) => {
    const original = await db.getItem(req.params.id);

    if (!original) {
        res.status(404).send({ erreur: 'Tâche introuvable.' });
        return;
    }

    const copie = {
        id: uuid(),
        name: `${original.name} (copie)`,
        completed: defaults.completed,
    };

    await db.storeItem(copie);
    res.send(copie);
};