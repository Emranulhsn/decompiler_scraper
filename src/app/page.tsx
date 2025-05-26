"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Globe, Download, FileText, Code, Folder, Play, Zap } from "lucide-react";
import FileExplorer from "@/components/FileExplorer";

interface DecompilationJob {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  results?: {
    jsFiles: number;
    cssFiles: number;
    components: number;
    modules: number;
  };
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [currentJob, setCurrentJob] = useState<DecompilationJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) {
      toast.error("Please enter a valid URL");
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    const jobId = Math.random().toString(36).substr(2, 9);

    const newJob: DecompilationJob = {
      id: jobId,
      url,
      status: 'pending',
      progress: 0
    };

    setCurrentJob(newJob);
    toast.success("Starting decompilation...");

    // Simulate progress while API is running
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress < 90) {
        setCurrentJob(prev => prev ? { ...prev, status: 'running', progress: Math.min(progress, 90) } : null);
      }
    }, 300);

    try {
      // Start the decompilation process
      const response = await fetch('/api/decompile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, jobId }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Failed to start decompilation');
      }

      // Handle the response
      const data = await response.json();

      if (data.success) {
        setCurrentJob({
          ...newJob,
          status: 'completed',
          progress: 100,
          results: {
            jsFiles: data.results.jsFiles,
            cssFiles: data.results.cssFiles,
            components: data.results.components,
            modules: data.results.modules
          }
        });
        setIsLoading(false);
        toast.success("Decompilation completed!");
      } else {
        throw new Error(data.error || 'Decompilation failed');
      }

    } catch (error) {
      clearInterval(progressInterval);
      const errorMessage = error instanceof Error ? error.message : "Failed to start decompilation";
      toast.error(errorMessage);
      setCurrentJob(null);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-blue-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Web Decompiler
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Advanced web application decompiler that extracts, beautifies, and analyzes JavaScript and CSS bundles
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto space-y-6">
          {/* URL Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Website URL
              </CardTitle>
              <CardDescription>
                Enter the URL of the website you want to decompile and analyze
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading}>
                  <Play className="h-4 w-4 mr-2" />
                  {isLoading ? "Processing..." : "Decompile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Progress & Results */}
          {currentJob && (
            <Card>
              <CardHeader>
                <CardTitle>Decompilation Progress</CardTitle>
                <CardDescription>Processing: {currentJob.url}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(currentJob.progress)}%</span>
                  </div>
                  <Progress value={currentJob.progress} className="h-2" />
                </div>

                {currentJob.status === 'completed' && currentJob.results && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <FileText className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{currentJob.results.jsFiles}</div>
                      <div className="text-sm text-muted-foreground">JS Files</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <Code className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{currentJob.results.cssFiles}</div>
                      <div className="text-sm text-muted-foreground">CSS Files</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <Folder className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{currentJob.results.components}</div>
                      <div className="text-sm text-muted-foreground">Components</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                      <Download className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{currentJob.results.modules}</div>
                      <div className="text-sm text-muted-foreground">Modules</div>
                    </div>
                  </div>
                )}

                {currentJob.status === 'completed' && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFileExplorer(true)}
                    >
                      <Folder className="h-4 w-4 mr-2" />
                      Browse Files
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (currentJob) {
                          window.open(`/api/download/${currentJob.id}`, '_blank');
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download ZIP
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* File Explorer */}
          {showFileExplorer && currentJob && currentJob.status === 'completed' && (
            <FileExplorer
              jobId={currentJob.id}
              onClose={() => setShowFileExplorer(false)}
            />
          )}

          {/* Features Overview */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔍 Deep Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Analyzes HTML structure, discovers all JS/CSS bundles, and attempts source map recovery
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">⚛️ React Extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Automatically extracts React components, hooks, and module structures from minified code
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🏗️ Reconstruction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Rebuilds logical project structure with beautified code and organized components
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
