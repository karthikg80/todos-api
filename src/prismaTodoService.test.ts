import { PrismaTodoService } from './prismaTodoService';
import { prisma } from './prismaClient';

describe('PrismaTodoService (Integration)', () => {
  let service: PrismaTodoService;

  beforeAll(() => {
    service = new PrismaTodoService(prisma);
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.todo.deleteMany();
  });

  describe('create', () => {
    it('should create a new todo in database', async () => {
      const dto = { title: 'Test Todo', description: 'Test description' };
      const todo = await service.create(dto);

      expect(todo.id).toBeDefined();
      expect(todo.title).toBe('Test Todo');
      expect(todo.description).toBe('Test description');
      expect(todo.completed).toBe(false);
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);

      // Verify in database
      const dbTodo = await prisma.todo.findUnique({ where: { id: todo.id } });
      expect(dbTodo).toBeDefined();
      expect(dbTodo!.title).toBe('Test Todo');
    });

    it('should create todo without description', async () => {
      const dto = { title: 'Test Todo' };
      const todo = await service.create(dto);

      expect(todo.title).toBe('Test Todo');
      expect(todo.description).toBeUndefined();
    });

    it('should generate unique IDs', async () => {
      const todo1 = await service.create({ title: 'Todo 1' });
      const todo2 = await service.create({ title: 'Todo 2' });

      expect(todo1.id).not.toBe(todo2.id);
    });

    it('should persist created todo across sessions', async () => {
      const created = await service.create({ title: 'Persistent Todo' });

      // Create new service instance to simulate new session
      const newService = new PrismaTodoService(prisma);
      const found = await newService.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe('Persistent Todo');
    });
  });

  describe('findAll', () => {
    it('should return empty array when no todos', async () => {
      const todos = await service.findAll();
      expect(todos).toEqual([]);
    });

    it('should return all todos from database', async () => {
      await service.create({ title: 'Todo 1' });
      await service.create({ title: 'Todo 2' });
      await service.create({ title: 'Todo 3' });

      const todos = await service.findAll();
      expect(todos).toHaveLength(3);

      const titles = todos.map(t => t.title);
      expect(titles).toContain('Todo 1');
      expect(titles).toContain('Todo 2');
      expect(titles).toContain('Todo 3');
    });

    it('should return todos in descending order by creation date', async () => {
      const todo1 = await service.create({ title: 'First' });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const todo2 = await service.create({ title: 'Second' });
      await new Promise(resolve => setTimeout(resolve, 10));
      const todo3 = await service.create({ title: 'Third' });

      const todos = await service.findAll();

      expect(todos[0].id).toBe(todo3.id); // Most recent first
      expect(todos[1].id).toBe(todo2.id);
      expect(todos[2].id).toBe(todo1.id);
    });
  });

  describe('findById', () => {
    it('should find todo by ID from database', async () => {
      const created = await service.create({ title: 'Test Todo' });
      const found = await service.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe('Test Todo');
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.findById('non-existent-id');
      expect(found).toBeNull();
    });

    it('should return null for invalid UUID', async () => {
      const found = await service.findById('invalid-uuid');
      expect(found).toBeNull();
    });

    it('should find todo with all fields populated', async () => {
      const created = await service.create({
        title: 'Full Todo',
        description: 'Complete description'
      });

      const found = await service.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe('Full Todo');
      expect(found!.description).toBe('Complete description');
      expect(found!.completed).toBe(false);
      expect(found!.createdAt).toBeInstanceOf(Date);
      expect(found!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('should update todo title in database', async () => {
      const created = await service.create({ title: 'Original Title' });
      const updated = await service.update(created.id, { title: 'Updated Title' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.id).toBe(created.id);
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());

      // Verify in database
      const dbTodo = await prisma.todo.findUnique({ where: { id: created.id } });
      expect(dbTodo!.title).toBe('Updated Title');
    });

    it('should update todo description', async () => {
      const created = await service.create({ title: 'Test', description: 'Original' });
      const updated = await service.update(created.id, { description: 'Updated' });

      expect(updated!.description).toBe('Updated');
      expect(updated!.title).toBe('Test');
    });

    it('should update todo completed status', async () => {
      const created = await service.create({ title: 'Test' });
      expect(created.completed).toBe(false);

      const updated = await service.update(created.id, { completed: true });
      expect(updated!.completed).toBe(true);

      // Verify in database
      const dbTodo = await prisma.todo.findUnique({ where: { id: created.id } });
      expect(dbTodo!.completed).toBe(true);
    });

    it('should update multiple fields', async () => {
      const created = await service.create({ title: 'Original' });
      const updated = await service.update(created.id, {
        title: 'Updated',
        description: 'New description',
        completed: true
      });

      expect(updated!.title).toBe('Updated');
      expect(updated!.description).toBe('New description');
      expect(updated!.completed).toBe(true);
    });

    it('should return null for non-existent ID', async () => {
      const updated = await service.update('non-existent-id', { title: 'Test' });
      expect(updated).toBeNull();
    });

    it('should return null for invalid UUID', async () => {
      const updated = await service.update('invalid-uuid', { title: 'Test' });
      expect(updated).toBeNull();
    });

    it('should update the updatedAt timestamp', async () => {
      const created = await service.create({ title: 'Test' });
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await service.update(created.id, { title: 'Updated' });
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should persist updates across sessions', async () => {
      const created = await service.create({ title: 'Original' });
      await service.update(created.id, { title: 'Updated' });

      // Create new service instance to simulate new session
      const newService = new PrismaTodoService(prisma);
      const found = await newService.findById(created.id);

      expect(found!.title).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should delete todo from database', async () => {
      const created = await service.create({ title: 'Test' });
      const deleted = await service.delete(created.id);

      expect(deleted).toBe(true);

      // Verify deletion in database
      const dbTodo = await prisma.todo.findUnique({ where: { id: created.id } });
      expect(dbTodo).toBeNull();

      // Verify through service
      const found = await service.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const deleted = await service.delete('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should return false for invalid UUID', async () => {
      const deleted = await service.delete('invalid-uuid');
      expect(deleted).toBe(false);
    });

    it('should remove todo from list', async () => {
      const todo1 = await service.create({ title: 'Todo 1' });
      const todo2 = await service.create({ title: 'Todo 2' });

      await service.delete(todo1.id);
      const todos = await service.findAll();

      expect(todos).toHaveLength(1);
      expect(todos[0].id).toBe(todo2.id);
    });

    it('should persist deletion across sessions', async () => {
      const created = await service.create({ title: 'To Delete' });
      await service.delete(created.id);

      // Create new service instance to simulate new session
      const newService = new PrismaTodoService(prisma);
      const found = await newService.findById(created.id);

      expect(found).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all todos from database', async () => {
      await service.create({ title: 'Todo 1' });
      await service.create({ title: 'Todo 2' });
      await service.create({ title: 'Todo 3' });

      await service.clear();

      const todos = await service.findAll();
      expect(todos).toHaveLength(0);

      // Verify in database
      const dbCount = await prisma.todo.count();
      expect(dbCount).toBe(0);
    });

    it('should work when no todos exist', async () => {
      await expect(service.clear()).resolves.not.toThrow();

      const todos = await service.findAll();
      expect(todos).toHaveLength(0);
    });
  });

  describe('database constraints', () => {
    it('should enforce title max length (200 chars)', async () => {
      const longTitle = 'a'.repeat(201);
      await expect(
        service.create({ title: longTitle })
      ).rejects.toThrow();
    });

    it('should enforce description max length (1000 chars)', async () => {
      const longDescription = 'a'.repeat(1001);
      await expect(
        service.create({ title: 'Test', description: longDescription })
      ).rejects.toThrow();
    });

    it('should allow null description', async () => {
      const todo = await service.create({ title: 'Test' });
      expect(todo.description).toBeUndefined();

      const dbTodo = await prisma.todo.findUnique({ where: { id: todo.id } });
      expect(dbTodo!.description).toBeNull();
    });
  });
});
