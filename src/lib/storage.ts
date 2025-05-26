interface ModuleInfo {
  identifier: string;
  match: string;
  source: string;
}

interface DecompilationResult {
  jobId: string;
  url: string;
  timestamp: number;
  bundles: Array<{
    url: string;
    type: 'js' | 'css';
    filename: string;
  }>;
  components: Array<{
    name: string;
    code: string;
    source: string;
  }>;
  modules: ModuleInfo[];
  originalFiles: { [key: string]: string };
  beautifiedFiles: { [key: string]: string };
  analysis: {
    jsFiles: number;
    cssFiles: number;
    components: number;
    modules: number;
  };
}

// Simple in-memory storage (in production, use a database)
const storage = new Map<string, DecompilationResult>();

export const jobStorage = {
  save: (jobId: string, result: DecompilationResult) => {
    storage.set(jobId, { ...result, timestamp: Date.now() });
  },

  get: (jobId: string): DecompilationResult | null => {
    return storage.get(jobId) || null;
  },

  list: (): DecompilationResult[] => {
    return Array.from(storage.values()).sort((a, b) => b.timestamp - a.timestamp);
  },

  delete: (jobId: string): boolean => {
    return storage.delete(jobId);
  },

  clear: () => {
    storage.clear();
  }
};

export type { DecompilationResult };
