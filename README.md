# Todos REST API

A complete REST API for managing todos with CRUD operations, input validation, and comprehensive tests.

## Features

- Full CRUD operations (Create, Read, Update, Delete)
- Input validation with detailed error messages
- TypeScript for type safety
- Comprehensive test suite with 62 tests
- In-memory data storage

## Installation

```bash
npm install
```

## Running the API

### Development mode (with auto-reload)
```bash
npm run dev
```

### Production mode
```bash
npm start
```

The server will start on port 3000 by default.

## API Endpoints

### Create a Todo
```
POST /todos
Content-Type: application/json

{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread" (optional)
}

Response: 201 Created
{
  "id": "uuid",
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "completed": false,
  "createdAt": "2026-02-06T...",
  "updatedAt": "2026-02-06T..."
}
```

### Get All Todos
```
GET /todos

Response: 200 OK
[
  {
    "id": "uuid",
    "title": "Buy groceries",
    "description": "Milk, eggs, bread",
    "completed": false,
    "createdAt": "2026-02-06T...",
    "updatedAt": "2026-02-06T..."
  }
]
```

### Get a Single Todo
```
GET /todos/:id

Response: 200 OK
{
  "id": "uuid",
  "title": "Buy groceries",
  ...
}

Response: 404 Not Found
{
  "error": "Todo not found"
}
```

### Update a Todo
```
PUT /todos/:id
Content-Type: application/json

{
  "title": "Buy groceries and cook dinner" (optional),
  "description": "Updated description" (optional),
  "completed": true (optional)
}

Response: 200 OK
{
  "id": "uuid",
  "title": "Buy groceries and cook dinner",
  "description": "Updated description",
  "completed": true,
  "createdAt": "2026-02-06T...",
  "updatedAt": "2026-02-06T..."
}

Response: 404 Not Found
{
  "error": "Todo not found"
}
```

### Delete a Todo
```
DELETE /todos/:id

Response: 204 No Content

Response: 404 Not Found
{
  "error": "Todo not found"
}
```

## Validation Rules

### Title
- Required
- Must be a string
- Cannot be empty (after trimming whitespace)
- Maximum 200 characters

### Description
- Optional
- Must be a string if provided
- Maximum 1000 characters

### Completed
- Must be a boolean if provided

## Testing

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Project Structure

```
src/
├── types.ts              # TypeScript type definitions
├── validation.ts         # Input validation logic
├── validation.test.ts    # Validation tests
├── todoService.ts        # Todo service (business logic)
├── todoService.test.ts   # Service tests
├── app.ts                # Express app configuration
├── app.test.ts           # API endpoint tests
└── server.ts             # Server entry point
```

## Technology Stack

- Node.js
- Express
- TypeScript
- Jest (testing framework)
- Supertest (HTTP testing)
