import type { Project, Todo } from "../../types";
import type { DecideNextWorkResult } from "../../types/plannerTypes";
import {
  buildDecisionReason,
  buildTaskIndex,
  classifyTaskEffort,
  classifyTaskImpact,
  dependentCounts,
  isOpenTask,
  scoreTaskForDecision,
  taskFitsAvailableMinutes,
  taskFitsContext,
  taskFitsEnergy,
} from "./plannerHeuristics";

export class DecisionEngine {
  decideNextWork(input: {
    projects: Project[];
    tasks: Todo[];
    now: Date;
    availableMinutes?: number | null;
    energy?: Todo["energy"] | null;
    context: string[];
  }): DecideNextWorkResult {
    const openTasks = input.tasks.filter(isOpenTask);
    const taskIndex = buildTaskIndex(openTasks);
    const dependents = dependentCounts(openTasks);
    const projectIndex = new Map(
      input.projects.map((project) => [project.id, project]),
    );

    const recommendedTasks = openTasks
      .filter(
        (task) => task.status !== "waiting" && task.status !== "cancelled",
      )
      .map((task) => {
        const blocked = task.dependsOnTaskIds.some((dependencyId) => {
          const dependency = taskIndex.get(dependencyId);
          return Boolean(dependency && isOpenTask(dependency));
        });
        return {
          task,
          blocked,
          score: scoreTaskForDecision({
            task,
            now: input.now,
            blocked,
            availableMinutes: input.availableMinutes,
            availableEnergy: input.energy,
            contexts: input.context,
            dependentCount: dependents.get(task.id) || 0,
          }),
        };
      })
      .filter(({ task, blocked }) => {
        if (blocked) return false;
        if (!taskFitsContext(task, input.context)) return false;
        if (!taskFitsEnergy(task, input.energy)) return false;
        if (!taskFitsAvailableMinutes(task, input.availableMinutes)) {
          return false;
        }
        if (task.startDate && task.startDate > input.now) {
          return false;
        }
        if (task.scheduledDate && task.scheduledDate > input.now) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map(({ task, blocked }) => ({
        taskId: task.id,
        projectId:
          (task.projectId && projectIndex.get(task.projectId)?.id) ||
          task.projectId ||
          null,
        title: task.title,
        reason: buildDecisionReason({
          task,
          now: input.now,
          blocked,
          dependentCount: dependents.get(task.id) || 0,
        }),
        impact: classifyTaskImpact(task, input.now),
        effort: classifyTaskEffort(task),
      }));

    return { recommendedTasks };
  }
}
