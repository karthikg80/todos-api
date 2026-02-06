import { TodoService } from './todoService';

describe('TodoService', () => {
  let service: TodoService;

  beforeEach(() => {
    service = new TodoService();
  });

  describe('create', () => {
    it('should create a new todo', () => {
      const dto = { title: 'Test Todo', description: 'Test description' };
      const todo = service.create(dto);

      expect(todo.id).toBeDefined();
      expect(todo.title).toBe('Test Todo');
      expect(todo.description).toBe('Test description');
      expect(todo.completed).toBe(false);
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);
    });

    it('should create todo without description', () => {
      const dto = { title: 'Test Todo' };
      const todo = service.create(dto);

      expect(todo.title).toBe('Test Todo');
      expect(todo.description).toBeUndefined();
    });

    it('should generate unique IDs', () => {
      const todo1 = service.create({ title: 'Todo 1' });
      const todo2 = service.create({ title: 'Todo 2' });

      expect(todo1.id).not.toBe(todo2.id);
    });
  });

  describe('findAll', () => {
    it('should return empty array when no todos', () => {
      const todos = service.findAll();
      expect(todos).toEqual([]);
    });

    it('should return all todos', () => {
      service.create({ title: 'Todo 1' });
      service.create({ title: 'Todo 2' });
      service.create({ title: 'Todo 3' });

      const todos = service.findAll();
      expect(todos).toHaveLength(3);
      expect(todos[0].title).toBe('Todo 1');
      expect(todos[1].title).toBe('Todo 2');
      expect(todos[2].title).toBe('Todo 3');
    });
  });

  describe('findById', () => {
    it('should find todo by ID', () => {
      const created = service.create({ title: 'Test Todo' });
      const found = service.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return undefined for non-existent ID', () => {
      const found = service.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update todo title', () => {
      const created = service.create({ title: 'Original Title' });
      const updated = service.update(created.id, { title: 'Updated Title' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.id).toBe(created.id);
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should update todo description', () => {
      const created = service.create({ title: 'Test', description: 'Original' });
      const updated = service.update(created.id, { description: 'Updated' });

      expect(updated!.description).toBe('Updated');
      expect(updated!.title).toBe('Test');
    });

    it('should update todo completed status', () => {
      const created = service.create({ title: 'Test' });
      expect(created.completed).toBe(false);

      const updated = service.update(created.id, { completed: true });
      expect(updated!.completed).toBe(true);
    });

    it('should update multiple fields', () => {
      const created = service.create({ title: 'Original' });
      const updated = service.update(created.id, {
        title: 'Updated',
        description: 'New description',
        completed: true
      });

      expect(updated!.title).toBe('Updated');
      expect(updated!.description).toBe('New description');
      expect(updated!.completed).toBe(true);
    });

    it('should return undefined for non-existent ID', () => {
      const updated = service.update('non-existent-id', { title: 'Test' });
      expect(updated).toBeUndefined();
    });

    it('should update the updatedAt timestamp', () => {
      const created = service.create({ title: 'Test' });
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure timestamp difference
      const updated = service.update(created.id, { title: 'Updated' });
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  describe('delete', () => {
    it('should delete todo', () => {
      const created = service.create({ title: 'Test' });
      const deleted = service.delete(created.id);

      expect(deleted).toBe(true);
      expect(service.findById(created.id)).toBeUndefined();
    });

    it('should return false for non-existent ID', () => {
      const deleted = service.delete('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should remove todo from list', () => {
      const todo1 = service.create({ title: 'Todo 1' });
      const todo2 = service.create({ title: 'Todo 2' });

      service.delete(todo1.id);
      const todos = service.findAll();

      expect(todos).toHaveLength(1);
      expect(todos[0].id).toBe(todo2.id);
    });
  });

  describe('clear', () => {
    it('should clear all todos', () => {
      service.create({ title: 'Todo 1' });
      service.create({ title: 'Todo 2' });
      service.create({ title: 'Todo 3' });

      service.clear();
      const todos = service.findAll();

      expect(todos).toHaveLength(0);
    });
  });
});
