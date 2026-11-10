import { MESSAGES } from "@/app/_lib/tasks";
import type { Task } from "@/app/_lib/tasks";

export type TaskListProps = { tasks: Task[] | null };

export function TaskList({ tasks }: TaskListProps) {
  if (tasks === null) {
    return <p role="alert">{MESSAGES.loadFailed}</p>;
  }
  if (tasks.length === 0) {
    return <p>{MESSAGES.empty}</p>;
  }
  return (
    <ul className="task-list" aria-labelledby="tasks-heading">
      {tasks.map((task) => (
        <li key={task.id}>
          <span>{task.title}</span>
          <span className="task-due">{task.due_date ?? MESSAGES.noDueDate}</span>
        </li>
      ))}
    </ul>
  );
}
