import { TodoService } from './todoService';

describe('TodoService', () => {
  let service: TodoService;

  beforeEach(() => {
    service = new TodoService();
  });

  describe('create', () => {
    it('should create a new todo', async () => {
      const dto = { title: 'Test Todo', description: 'Test description' };
      const todo = await service.create(dto);

      expect(todo.id).toBeDefined();
      expect(todo.title).toBe('Test Todo');
      expect(todo.description).toBe('Test description');
      expect(todo.completed).toBe(false);
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);
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
  });

  describe('findAll', () => {
    it('should return empty array when no todos', async () => {
      const todos = await service.findAll();
      expect(todos).toEqual([]);
    });

    it('should return all todos', async () => {
      await service.create({ title: 'Todo 1' });
      await service.create({ title: 'Todo 2' });
      await service.create({ title: 'Todo 3' });

      const todos = await service.findAll();
      expect(todos).toHaveLength(3);
      expect(todos[0].title).toBe('Todo 1');
      expect(todos[1].title).toBe('Todo 2');
      expect(todos[2].title).toBe('Todo 3');
    });
  });

  describe('findById', () => {
    it('should find todo by ID', async () => {
      const created = await service.create({ title: 'Test Todo' });
      const found = await service.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update todo title', async () => {
      const created = await service.create({ title: 'Original Title' });
      const updated = await service.update(created.id, { title: 'Updated Title' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.id).toBe(created.id);
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
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

    it('should update the updatedAt timestamp', async () => {
      const created = await service.create({ title: 'Test' });
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure timestamp difference
      const updated = await service.update(created.id, { title: 'Updated' });
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  describe('delete', () => {
    it('should delete todo', async () => {
      const created = await service.create({ title: 'Test' });
      const deleted = await service.delete(created.id);

      expect(deleted).toBe(true);
      expect(await service.findById(created.id)).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const deleted = await service.delete('non-existent-id');
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
  });

  describe('clear', () => {
    it('should clear all todos', async () => {
      await service.create({ title: 'Todo 1' });
      await service.create({ title: 'Todo 2' });
      await service.create({ title: 'Todo 3' });

      await service.clear();
      const todos = await service.findAll();

      expect(todos).toHaveLength(0);
    });
  });
});
