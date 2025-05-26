"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  Download,
  Folder,
  Code,
  Package,
  Eye,
  ExternalLink,
  FileCode,
  Palette
} from 'lucide-react';
import { toast } from 'sonner';

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  size?: number;
  category: 'original' | 'beautified' | 'components' | 'modules';
  content?: string;
}

interface FileExplorerProps {
  jobId: string;
  onClose?: () => void;
}

interface JobData {
  jobId: string;
  url: string;
  files: FileItem[];
  analysis: {
    jsFiles: number;
    cssFiles: number;
    components: number;
    modules: number;
  };
  bundles: Array<{
    url: string;
    type: 'js' | 'css';
    filename: string;
  }>;
}

export default function FileExplorer({ jobId, onClose }: FileExplorerProps) {
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    const loadJobData = async () => {
      try {
        const response = await fetch(`/api/files/${jobId}`);
        if (!response.ok) {
          throw new Error('Failed to load job data');
        }

        const data = await response.json();
        if (data.success) {
          setJobData(data);
        } else {
          throw new Error(data.error || 'Failed to load data');
        }
      } catch (error) {
        toast.error('Failed to load file data');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadJobData();
  }, [jobId]);

  const loadFileContent = async (fileName: string) => {
    try {
      const response = await fetch(`/api/files/${jobId}?file=${encodeURIComponent(fileName)}`);
      if (!response.ok) {
        throw new Error('Failed to load file content');
      }

      const data = await response.json();
      if (data.success) {
        setFileContent(data.file.content);
        setSelectedFile(fileName);
        setViewDialogOpen(true);
      } else {
        throw new Error(data.error || 'Failed to load file');
      }
    } catch (error) {
      toast.error('Failed to load file content');
      console.error(error);
    }
  };

  const downloadZip = async () => {
    try {
      const response = await fetch(`/api/download/${jobId}`);
      if (!response.ok) {
        throw new Error('Failed to download files');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decompiled_${jobId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Download started!');
    } catch (error) {
      toast.error('Failed to download files');
      console.error(error);
    }
  };

  const getFileIcon = (fileName: string, category: string) => {
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) {
      return <FileCode className="h-4 w-4 text-yellow-500" />;
    }
    if (fileName.endsWith('.css')) {
      return <Palette className="h-4 w-4 text-blue-500" />;
    }
    if (fileName.endsWith('.html')) {
      return <Code className="h-4 w-4 text-orange-500" />;
    }
    if (category === 'components') {
      return <Package className="h-4 w-4 text-purple-500" />;
    }
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (size?: number) => {
    if (!size) return 'Unknown';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filterFilesByCategory = (category: string) => {
    if (!jobData) return [];
    return jobData.files.filter(file => file.category === category);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading file explorer...</div>
        </CardContent>
      </Card>
    );
  }

  if (!jobData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Failed to load job data</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                File Explorer
              </CardTitle>
              <CardDescription>
                Browsing results for: {jobData.url}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={downloadZip} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download ZIP
              </Button>
              {onClose && (
                <Button onClick={onClose} variant="outline">
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* File Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="original" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="original">
                Original ({filterFilesByCategory('original').length})
              </TabsTrigger>
              <TabsTrigger value="beautified">
                Beautified ({filterFilesByCategory('beautified').length})
              </TabsTrigger>
              <TabsTrigger value="components">
                Components ({filterFilesByCategory('components').length})
              </TabsTrigger>
              <TabsTrigger value="modules">
                Modules ({jobData.analysis.modules})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="mt-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Original Files</h3>
                {filterFilesByCategory('original').map((file) => (
                  <div key={`original-${file.name}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.name, file.category)}
                      <div>
                        <div className="font-medium">{file.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadFileContent(file.name)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="beautified" className="mt-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Beautified Files</h3>
                {filterFilesByCategory('beautified').map((file) => (
                  <div key={`beautified-${file.name}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.name, file.category)}
                      <div>
                        <div className="font-medium">{file.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadFileContent(file.name)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="components" className="mt-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Extracted Components</h3>
                {filterFilesByCategory('components').map((file) => (
                  <div key={`components-${file.name}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.name, file.category)}
                      <div>
                        <div className="font-medium">{file.name}</div>
                        <div className="text-sm text-muted-foreground">
                          React Component • {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadFileContent(file.name)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="modules" className="mt-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Bundle Information</h3>
                {jobData.bundles.map((bundle) => (
                  <div key={`bundle-${bundle.url}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {bundle.type === 'js' ? (
                        <FileCode className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <Palette className="h-4 w-4 text-blue-500" />
                      )}
                      <div>
                        <div className="font-medium">{bundle.filename}</div>
                        <div className="text-sm text-muted-foreground">
                          {bundle.type.toUpperCase()} Bundle
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(bundle.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* File Content Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedFile}
            </DialogTitle>
            <DialogDescription>
              File content viewer
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <Textarea
              value={fileContent}
              readOnly
              className="min-h-[400px] font-mono text-sm resize-none"
              placeholder="Loading file content..."
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
