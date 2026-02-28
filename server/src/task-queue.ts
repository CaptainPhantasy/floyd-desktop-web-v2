/**
 * Floyd Desktop - Task Queue
 * 
 * Manages async multimedia generation tasks (primarily video).
 * Provides task status tracking, result storage, and cleanup.
 * 
 * Created: 2026-02-28 15:38:00 UTC
 * Phase: P2-5
 */

import { v4 as uuidv4 } from 'uuid';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type TaskType = 'video-generation' | 'image-generation' | 'audio-generation';

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress?: number; // 0-100
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  result?: {
    data?: string; // Base64 or URL
    metadata?: Record<string, any>;
  };
  error?: string;
  metadata?: {
    prompt?: string;
    model?: string;
    externalTaskId?: string; // For polling external APIs
  };
}

export interface TaskCreateOptions {
  type: TaskType;
  metadata?: Task['metadata'];
}

export class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private maxAge: number; // Maximum task age in ms
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxAgeMs: number = 3600000) { // Default 1 hour
    this.maxAge = maxAgeMs;
    this.startCleanupInterval();
  }

  /**
   * Create a new task and return its ID
   */
  createTask(options: TaskCreateOptions): Task {
    const task: Task = {
      id: uuidv4(),
      type: options.type,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: options.metadata,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Update task status
   */
  updateStatus(taskId: string, status: TaskStatus, progress?: number): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = status;
    task.updatedAt = Date.now();
    if (progress !== undefined) {
      task.progress = progress;
    }
    if (status === 'completed' || status === 'failed') {
      task.completedAt = Date.now();
    }

    this.tasks.set(taskId, task);
    return true;
  }

  /**
   * Set task result (for completed tasks)
   */
  setResult(taskId: string, result: Task['result']): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.result = result;
    task.status = 'completed';
    task.updatedAt = Date.now();
    task.completedAt = Date.now();
    task.progress = 100;

    this.tasks.set(taskId, task);
    return true;
  }

  /**
   * Set task error (for failed tasks)
   */
  setError(taskId: string, error: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.error = error;
    task.status = 'failed';
    task.updatedAt = Date.now();
    task.completedAt = Date.now();

    this.tasks.set(taskId, task);
    return true;
  }

  /**
   * Update task metadata (e.g., store external task ID for polling)
   */
  updateMetadata(taskId: string, metadata: Partial<Task['metadata']>): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.metadata = { ...task.metadata, ...metadata };
    task.updatedAt = Date.now();

    this.tasks.set(taskId, task);
    return true;
  }

  /**
   * Get all tasks (optionally filtered by status)
   */
  getTasks(status?: TaskStatus): Task[] {
    const allTasks = Array.from(this.tasks.values());
    if (status) {
      return allTasks.filter(t => t.status === status);
    }
    return allTasks;
  }

  /**
   * Get tasks by type
   */
  getTasksByType(type: TaskType): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.type === type);
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const allTasks = Array.from(this.tasks.values());
    return {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      processing: allTasks.filter(t => t.status === 'processing').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
    };
  }

  /**
   * Clean up old tasks
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, task] of this.tasks.entries()) {
      if (now - task.createdAt > this.maxAge) {
        this.tasks.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    // Run cleanup every 10 minutes
    this.cleanupInterval = setInterval(() => {
      const removed = this.cleanup();
      if (removed > 0) {
        console.log(`[TaskQueue] Cleaned up ${removed} old tasks`);
      }
    }, 600000);
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const taskQueue = new TaskQueue();
