// Renvoie toutes les tâches
const db = require('../persistence');

module.exports = async (req, res) => {
    const allitems = await db.getItems();
    const items = await allitems.slice(req.params.number)
    res.send(items);
};
