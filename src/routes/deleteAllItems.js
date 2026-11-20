// Supprime toutes les tâches
const db = require('../persistence');

module.exports = async (req, res) => {
    await db.removeAllItems; // suppression en base
    res.sendStatus(200);
};