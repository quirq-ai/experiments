"use client";

import { useCallback, useState } from "react";
import type { Issue, IssueStatus, Priority } from "@/lib/types";

/*
  Local filter state for issue list views. Each dimension is a multi-select;
  an empty dimension means no constraint. `null` inside assigneeIds matches
  unassigned issues.
*/

export interface IssueFilters {
  status: IssueStatus[];
  priority: Priority[];
  assigneeIds: (string | null)[];
  labelIds: string[];
}

const EMPTY_FILTERS: IssueFilters = {
  status: [],
  priority: [],
  assigneeIds: [],
  labelIds: [],
};

export function useIssueFilters() {
  const [filters, setFilters] = useState<IssueFilters>(EMPTY_FILTERS);

  const apply = useCallback(
    (issues: Issue[]) =>
      issues.filter((issue) => {
        if (filters.status.length > 0 && !filters.status.includes(issue.status)) {
          return false;
        }
        if (filters.priority.length > 0 && !filters.priority.includes(issue.priority)) {
          return false;
        }
        if (
          filters.assigneeIds.length > 0 &&
          !filters.assigneeIds.includes(issue.assigneeId ?? null)
        ) {
          return false;
        }
        if (
          filters.labelIds.length > 0 &&
          !filters.labelIds.some((id) => issue.labelIds.includes(id))
        ) {
          return false;
        }
        return true;
      }),
    [filters]
  );

  return { filters, setFilters, apply };
}
