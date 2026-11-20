const db = require('../persistence');

module.exports = async (req, res) => {
    const items = db.getItems().map(item => item.name);
    const name = req.query.name
    const existing = items.some((nom) => nom.toLowerCase() === name);
    res.send(existing);
};
