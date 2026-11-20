// récupère la tâche la plus longue
const db = require('../persistence');

module.exports = async (req, res) => {
    const items = await db.getItems();
    res.send(items);
};
