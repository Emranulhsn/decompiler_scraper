import { type NextRequest, NextResponse } from 'next/server';
import { jobStorage } from '@/lib/storage';
import JSZip from 'jszip';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const result = jobStorage.get(jobId);

    if (!result) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const zip = new JSZip();

    // Add original files
    const originalFolder = zip.folder('original');
    for (const [filename, content] of Object.entries(result.originalFiles)) {
      originalFolder?.file(filename, content);
    }

    // Add beautified files
    const beautifiedFolder = zip.folder('beautified');
    for (const [filename, content] of Object.entries(result.beautifiedFiles)) {
      beautifiedFolder?.file(filename, content);
    }

    // Add extracted components
    const componentsFolder = zip.folder('extracted/components');
    result.components.forEach((component, index) => {
      const filename = `${component.name}_${index}.jsx`;
      const content = `// Extracted from: ${component.source}\n// Component: ${component.name}\n\n${component.code}`;
      componentsFolder?.file(filename, content);
    });

    // Add modules info
    const modulesFolder = zip.folder('extracted/modules');
    const modulesContent = JSON.stringify(result.modules, null, 2);
    modulesFolder?.file('modules.json', modulesContent);

    // Add analysis report
    const reportContent = {
      url: result.url,
      timestamp: new Date(result.timestamp).toISOString(),
      analysis: result.analysis,
      bundles: result.bundles,
      totalFiles: Object.keys(result.originalFiles).length + Object.keys(result.beautifiedFiles).length,
      extractedComponents: result.components.length,
      extractedModules: result.modules.length
    };

    zip.file('analysis_report.json', JSON.stringify(reportContent, null, 2));

    // Add README
    const readmeContent = `# Decompilation Results

Source URL: ${result.url}
Generated: ${new Date(result.timestamp).toLocaleString()}

## Analysis Summary
- JavaScript files: ${result.analysis.jsFiles}
- CSS files: ${result.analysis.cssFiles}
- React components: ${result.analysis.components}
- Modules: ${result.analysis.modules}

## Structure
- \`original/\` - Original minified files
- \`beautified/\` - Beautified versions
- \`extracted/components/\` - Extracted React components
- \`extracted/modules/\` - Module information
- \`analysis_report.json\` - Detailed analysis

## Note
This is a best-effort decompilation. Some functionality may be missing or incomplete.
`;

    zip.file('README.md', readmeContent);

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    // Return ZIP file
    const domain = new URL(result.url).hostname.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `decompiled_${domain}_${jobId}.zip`;

    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to generate download' },
      { status: 500 }
    );
  }
}
