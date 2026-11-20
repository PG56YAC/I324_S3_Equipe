const db = require('../../src/persistence');
const deleteAllItems = require('../../src/routes/deleteAllItems');

jest.mock('../../src/persistence', () => ({
    removeAllItems: jest.fn(),
    getItem: jest.fn(),
}));

test('supprime toutes les tâches', async () => {
    const req = {};
    const res = { sendStatus: jest.fn() };

    await deleteAllItems(req, res);

    expect(db.removeAllItems.mock.calls.length).toBe(0);
    expect(res.sendStatus.mock.calls[0].length).toBe(1);
    expect(res.sendStatus.mock.calls[0][0]).toBe(200);
});
