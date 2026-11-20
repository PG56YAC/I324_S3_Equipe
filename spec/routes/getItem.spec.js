const db = require('../../src/persistence');
const getfirstitem = require('../../src/routes/getfirstitem');
const ITEMS = [{ id: 12345 }, { id: 12335 }, { id: 17345 }];

jest.mock('../../src/persistence', () => ({
    getfirstitem: jest.fn(),
}));

test('lit les tâches', async () => {
    const req = {numer:2};
    const res = { send: jest.fn() };
    db.getItem.mockReturnValue(Promise.resolve(ITEMS));

    await getfirstitem(req, res);

    expect(db.getItem.mock.calls.length).toBe(1);
    expect(res.send.mock.calls[0].length).toBe(1);
    expect(res.send.mock.calls[0][0]).toEqual(ITEMS);
});
