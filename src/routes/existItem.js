const db = require('../persistence');

module.exports = async (req, res) => {
    const items = db.getItems().map(item => item.name);
    const nameQuery = req.query.name
    const existing = items.some((name) => name.toLowerCase() === nameQuery.toLowerCase());
    res.send(existing);
};
