const db = require('../../src/persistence');
const copyItem = require('../../src/routes/copyItem');
const { v4: uuid } = require('uuid');

jest.mock('uuid', () => ({ v4: jest.fn() }));

jest.mock('../../src/persistence', () => ({
    removeItem: jest.fn(),
    storeItem: jest.fn(),
    getItem: jest.fn(),
}));

beforeEach(() => {
    jest.clearAllMocks();
});

test('duplique une tâche existante', async () => {
    const nouvelId = 'nouvel-id';
    const original = { id: 'id-original', name: 'A sample item', completed: true };
    const req = { params: { id: original.id } };
    const res = { send: jest.fn(), status: jest.fn().mockReturnThis() };

    db.getItem.mockResolvedValue(original);
    uuid.mockReturnValue(nouvelId);

    await copyItem(req, res);

    const expectedItem = {
        id: nouvelId,
        name: 'A sample item (copie)',
        completed: false,
    };

    expect(db.getItem).toHaveBeenCalledWith(original.id);
    expect(db.storeItem.mock.calls.length).toBe(1);
    expect(db.storeItem.mock.calls[0][0]).toEqual(expectedItem);
    expect(res.send.mock.calls[0].length).toBe(1);
    expect(res.send.mock.calls[0][0]).toEqual(expectedItem);
});

test('la copie a un nouvel identifiant et n\'est pas terminée', async () => {
    const original = { id: 'id-original', name: 'Tâche', completed: true };
    const req = { params: { id: original.id } };
    const res = { send: jest.fn(), status: jest.fn().mockReturnThis() };

    db.getItem.mockResolvedValue(original);
    uuid.mockReturnValue('autre-id');

    await copyItem(req, res);

    const copie = res.send.mock.calls[0][0];

    expect(copie.id).not.toBe(original.id);
    expect(copie.completed).toBe(false);
});

test('renvoie 404 pour un identifiant inconnu', async () => {
    const req = { params: { id: 'inconnu' } };
    const res = { send: jest.fn(), status: jest.fn().mockReturnThis() };

    db.getItem.mockResolvedValue(undefined);

    await copyItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(db.storeItem).not.toHaveBeenCalled();
});