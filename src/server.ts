import { createApp } from './app';
import { TodoService } from './todoService';

const PORT = process.env.PORT || 3000;

const todoService = new TodoService();
const app = createApp(todoService);

app.listen(PORT, () => {
  console.log(`Todos API server running on port ${PORT}`);
});
