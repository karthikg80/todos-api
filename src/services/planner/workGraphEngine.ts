import type { Todo } from "../../types";
import type { AnalyzeWorkGraphResult } from "../../types/plannerTypes";
import {
  buildCriticalPath,
  buildTaskIndex,
  dependencyTitles,
  isOpenTask,
  openDependencyIdsForTask,
  toWorkGraphNode,
} from "./plannerHeuristics";

export class WorkGraphEngine {
  analyzeWorkGraph(input: {
    projectTasks: Todo[];
    allTasks: Todo[];
  }): AnalyzeWorkGraphResult {
    const openProjectTasks = input.projectTasks.filter(isOpenTask);
    const openTaskIndex = buildTaskIndex(input.allTasks.filter(isOpenTask));

    const blockedTasks = openProjectTasks
      .filter(
        (task) => openDependencyIdsForTask(task, openTaskIndex).length > 0,
      )
      .map((task) => {
        const blockers = dependencyTitles(task, openTaskIndex);
        return toWorkGraphNode(
          task,
          blockers.length
            ? `Blocked by ${blockers.join(", ")}.`
            : "Blocked by an open dependency.",
        );
      });

    const unblockedTasks = openProjectTasks
      .filter(
        (task) => openDependencyIdsForTask(task, openTaskIndex).length === 0,
      )
      .map((task) =>
        toWorkGraphNode(
          task,
          "This task has no open dependencies and can move immediately.",
        ),
      );

    const criticalPath = buildCriticalPath(openProjectTasks).map((task) =>
      toWorkGraphNode(
        task,
        "Part of the longest active dependency chain in the project.",
      ),
    );

    const parallelWork = unblockedTasks.filter(
      (task) =>
        !criticalPath.some(
          (criticalTask) => criticalTask.taskId === task.taskId,
        ),
    );

    return {
      blockedTasks,
      unblockedTasks,
      criticalPath,
      parallelWork,
    };
  }
}
