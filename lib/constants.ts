import type {
  TaskStatus,
  TaskPriority,
  LeaveType,
  LeaveStatus,
} from "@/lib/types";

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "paused",
  "submitted",
  "revision",
  "completed",
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  paused: "Paused",
  submitted: "Submitted",
  revision: "Revision",
  completed: "Completed",
};

/** Tailwind classes for status badges. */
export const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  paused: "bg-amber-100 text-amber-800 border-amber-200",
  submitted: "bg-violet-100 text-violet-700 border-violet-200",
  revision: "bg-orange-100 text-orange-700 border-orange-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-sky-100 text-sky-700 border-sky-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

// ---- Leave / time-off ----

export const LEAVE_TYPES: LeaveType[] = [
  "sick",
  "casual",
  "emergency",
  "vacation",
  "half_day",
  "wfh",
];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick: "Sick Leave",
  casual: "Casual Leave",
  emergency: "Emergency Leave",
  vacation: "Vacation",
  half_day: "Half Day",
  wfh: "Work From Home",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const LEAVE_STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};
