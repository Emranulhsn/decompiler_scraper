import { type NextRequest, NextResponse } from 'next/server';
import { jobStorage } from '@/lib/storage';

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  size?: number;
  category: 'original' | 'beautified' | 'components' | 'modules';
  content?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const url = new URL(request.url);
    const fileName = url.searchParams.get('file');

    const result = jobStorage.get(jobId);
    if (!result) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // If fileName is provided, return the specific file content
    if (fileName) {
      let content = '';
      let category = '';

      if (result.originalFiles[fileName]) {
        content = result.originalFiles[fileName];
        category = 'original';
      } else if (result.beautifiedFiles[fileName]) {
        content = result.beautifiedFiles[fileName];
        category = 'beautified';
      } else {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        file: {
          name: fileName,
          content,
          category,
          size: content.length
        }
      });
    }

    // Return file structure
    const files: FileItem[] = [];

    // Add original files
    for (const filename of Object.keys(result.originalFiles)) {
      files.push({
        name: filename,
        type: 'file',
        category: 'original',
        size: result.originalFiles[filename].length
      });
    }

    // Add beautified files
    for (const filename of Object.keys(result.beautifiedFiles)) {
      files.push({
        name: filename,
        type: 'file',
        category: 'beautified',
        size: result.beautifiedFiles[filename].length
      });
    }

    // Add extracted components as virtual files
    result.components.forEach((component, index) => {
      files.push({
        name: `${component.name}_${index}.jsx`,
        type: 'file',
        category: 'components',
        size: component.code.length
      });
    });

    return NextResponse.json({
      success: true,
      jobId,
      url: result.url,
      files,
      analysis: result.analysis,
      bundles: result.bundles
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve files' },
      { status: 500 }
    );
  }
}
