const mockDb = {
    query: jest.fn(),
    connect: jest.fn((callback) => callback())
}

module.export = mockDb;