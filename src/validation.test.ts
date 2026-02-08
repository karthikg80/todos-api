import { validateCreateTodo, validateUpdateTodo, validateId, validateReorderTodos, ValidationError } from './validation';

describe('Validation', () => {
  describe('validateCreateTodo', () => {
    it('should validate a valid todo creation', () => {
      const result = validateCreateTodo({
        title: 'Test Todo',
        description: 'Test description'
      });

      expect(result.title).toBe('Test Todo');
      expect(result.description).toBe('Test description');
    });

    it('should trim whitespace from title and description', () => {
      const result = validateCreateTodo({
        title: '  Test Todo  ',
        description: '  Test description  '
      });

      expect(result.title).toBe('Test Todo');
      expect(result.description).toBe('Test description');
    });

    it('should allow todo without description', () => {
      const result = validateCreateTodo({
        title: 'Test Todo'
      });

      expect(result.title).toBe('Test Todo');
      expect(result.description).toBeUndefined();
    });

    it('should throw error for missing title', () => {
      expect(() => validateCreateTodo({})).toThrow(ValidationError);
      expect(() => validateCreateTodo({})).toThrow('Title is required');
    });

    it('should throw error for empty title', () => {
      expect(() => validateCreateTodo({ title: '   ' })).toThrow(ValidationError);
      expect(() => validateCreateTodo({ title: '   ' })).toThrow('Title cannot be empty');
    });

    it('should throw error for non-string title', () => {
      expect(() => validateCreateTodo({ title: 123 })).toThrow(ValidationError);
      expect(() => validateCreateTodo({ title: 123 })).toThrow('Title is required and must be a string');
    });

    it('should throw error for title exceeding max length', () => {
      const longTitle = 'a'.repeat(201);
      expect(() => validateCreateTodo({ title: longTitle })).toThrow(ValidationError);
      expect(() => validateCreateTodo({ title: longTitle })).toThrow('Title cannot exceed 200 characters');
    });

    it('should throw error for non-string description', () => {
      expect(() => validateCreateTodo({ title: 'Test', description: 123 })).toThrow(ValidationError);
      expect(() => validateCreateTodo({ title: 'Test', description: 123 })).toThrow('Description must be a string');
    });

    it('should throw error for description exceeding max length', () => {
      const longDescription = 'a'.repeat(1001);
      expect(() => validateCreateTodo({ title: 'Test', description: longDescription })).toThrow(ValidationError);
      expect(() => validateCreateTodo({ title: 'Test', description: longDescription })).toThrow('Description cannot exceed 1000 characters');
    });

    it('should throw error for non-object input', () => {
      expect(() => validateCreateTodo(null)).toThrow(ValidationError);
      expect(() => validateCreateTodo('string')).toThrow(ValidationError);
      expect(() => validateCreateTodo(123)).toThrow(ValidationError);
    });
  });

  describe('validateUpdateTodo', () => {
    it('should validate a valid update with all fields', () => {
      const result = validateUpdateTodo({
        title: 'Updated Title',
        description: 'Updated description',
        completed: true
      });

      expect(result.title).toBe('Updated Title');
      expect(result.description).toBe('Updated description');
      expect(result.completed).toBe(true);
    });

    it('should validate update with only title', () => {
      const result = validateUpdateTodo({ title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
      expect(result.description).toBeUndefined();
      expect(result.completed).toBeUndefined();
    });

    it('should validate update with only description', () => {
      const result = validateUpdateTodo({ description: 'Updated description' });
      expect(result.description).toBe('Updated description');
      expect(result.title).toBeUndefined();
      expect(result.completed).toBeUndefined();
    });

    it('should validate update with only completed', () => {
      const result = validateUpdateTodo({ completed: true });
      expect(result.completed).toBe(true);
      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('should trim whitespace from title and description', () => {
      const result = validateUpdateTodo({
        title: '  Updated  ',
        description: '  Updated desc  '
      });

      expect(result.title).toBe('Updated');
      expect(result.description).toBe('Updated desc');
    });

    it('should throw error for empty update object', () => {
      expect(() => validateUpdateTodo({})).toThrow(ValidationError);
      expect(() => validateUpdateTodo({})).toThrow('At least one field must be provided');
    });

    it('should throw error for empty title', () => {
      expect(() => validateUpdateTodo({ title: '   ' })).toThrow(ValidationError);
      expect(() => validateUpdateTodo({ title: '   ' })).toThrow('Title cannot be empty');
    });

    it('should throw error for non-string title', () => {
      expect(() => validateUpdateTodo({ title: 123 })).toThrow(ValidationError);
      expect(() => validateUpdateTodo({ title: 123 })).toThrow('Title must be a string');
    });

    it('should throw error for non-boolean completed', () => {
      expect(() => validateUpdateTodo({ completed: 'true' })).toThrow(ValidationError);
      expect(() => validateUpdateTodo({ completed: 'true' })).toThrow('Completed must be a boolean');
    });

    it('should throw error for non-object input', () => {
      expect(() => validateUpdateTodo(null)).toThrow(ValidationError);
      expect(() => validateUpdateTodo('string')).toThrow(ValidationError);
    });
  });

  describe('validateId', () => {
    it('should validate a valid UUID', () => {
      expect(() => validateId('00000000-0000-1000-8000-000000000000')).not.toThrow();
    });

    it('should throw error for non-UUID string', () => {
      expect(() => validateId('valid-id')).toThrow(ValidationError);
      expect(() => validateId('valid-id')).toThrow('Invalid ID format');
    });

    it('should throw error for empty ID', () => {
      expect(() => validateId('')).toThrow(ValidationError);
      expect(() => validateId('')).toThrow('Invalid ID format');
    });

    it('should throw error for non-string ID', () => {
      expect(() => validateId(null as any)).toThrow(ValidationError);
      expect(() => validateId(123 as any)).toThrow(ValidationError);
    });
  });

  describe('validateReorderTodos', () => {
    it('should validate a valid reorder payload', () => {
      const items = validateReorderTodos([
        { id: '00000000-0000-1000-8000-000000000001', order: 0 },
        { id: '00000000-0000-1000-8000-000000000002', order: 1 },
      ]);
      expect(items).toHaveLength(2);
    });

    it('should throw when payload exceeds max item limit', () => {
      const payload = Array.from({ length: 501 }, (_, i) => ({
        id: `00000000-0000-1000-8000-${String(i + 1).padStart(12, '0')}`,
        order: i,
      }));
      expect(() => validateReorderTodos(payload)).toThrow('Cannot reorder more than 500 todos at once');
    });
  });
});
