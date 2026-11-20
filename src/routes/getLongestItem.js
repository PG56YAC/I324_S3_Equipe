// récupère la tâche la plus longue
const db = require('../persistence');

module.exports = async (req, res) => {
    const items = await db.getItems();

    if (items.length === 0) {
        return res.status(404).send();
    }

    const longestItem = items.reduce((longest, item) =>
        item.name.length > longest.name.length ? item : longest
    );

    res.send(longestItem);
};
