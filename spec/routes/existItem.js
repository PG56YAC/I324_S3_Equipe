const db = require('../../src/persistence');
const existItem = require('../../src/routes/existItem');
const ITEMS = [{ id: 1, name: 'courses' }, { id: 2, name: 'sport' }];

test('renvoie true si le nom existe', async () => {
    const req = { query: { name: 'courses' } };
    const res = { send: jest.fn() };
    db.getItems.mockReturnValue(ITEMS);

    await existItem(req, res);

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith(true);
});

test('renvoie false si le nom n\'existe pas', async () => {
    const req = { query: { name: 'inconnu' } };
    const res = { send: jest.fn() };
    db.getItems.mockReturnValue(ITEMS);

    await existItem(req, res);

    expect(res.send).toHaveBeenCalledWith(false);
});

