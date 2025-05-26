import { type NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import beautify from 'js-beautify';
import JSZip from 'jszip';
import { jobStorage, type DecompilationResult } from '@/lib/storage';

interface DecompilationRequest {
  url: string;
  jobId: string;
}

interface BundleInfo {
  url: string;
  type: 'js' | 'css';
  filename: string;
}

interface ExtractedComponent {
  name: string;
  code: string;
  source: string;
}

interface ModuleInfo {
  identifier: string;
  match: string;
  source: string;
}

interface SourceMapInfo {
  sources: string[];
  sourcesContent: string[];
  names?: string[];
  version?: number;
  file?: string;
  sourceRoot?: string;
}



class WebDecompiler {
  private baseUrl: string;
  private results: DecompilationResult;

  constructor(url: string, jobId: string) {
    this.baseUrl = url;
    this.results = {
      jobId,
      url,
      timestamp: Date.now(),
      bundles: [],
      components: [],
      modules: [],
      originalFiles: {},
      beautifiedFiles: {},
      analysis: {
        jsFiles: 0,
        cssFiles: 0,
        components: 0,
        modules: 0
      }
    };
  }

  async analyzeHTML(): Promise<BundleInfo[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const bundles: BundleInfo[] = [];

      // Find JavaScript bundles
      $('script[src]').each((_, element) => {
        const src = $(element).attr('src');
        if (src) {
          const fullUrl = src.startsWith('/') ? new URL(src, this.baseUrl).href : src;
          const filename = src.split('/').pop() || 'script.js';
          bundles.push({
            url: fullUrl,
            type: 'js',
            filename
          });
        }
      });

      // Find CSS bundles
      $('link[rel="stylesheet"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('/') ? new URL(href, this.baseUrl).href : href;
          const filename = href.split('/').pop() || 'style.css';
          bundles.push({
            url: fullUrl,
            type: 'css',
            filename
          });
        }
      });

      // Save original HTML
      this.results.originalFiles['index.html'] = response.data;
      this.results.bundles = bundles;

      return bundles;
    } catch (error) {
      console.error('Error analyzing HTML:', error);
      throw new Error('Failed to analyze HTML structure');
    }
  }

  async downloadAndDecompileJS(bundle: BundleInfo): Promise<void> {
    try {
      const response = await axios.get(bundle.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const jsContent = response.data;
      this.results.originalFiles[bundle.filename] = jsContent;

      // Beautify JavaScript
      try {
        const beautifiedJs = beautify(jsContent, {
          indent_size: 2,
          indent_char: ' ',
          max_preserve_newlines: 2,
          preserve_newlines: true,
          keep_array_indentation: false,
          break_chained_methods: false,
          space_before_conditional: true,
          brace_style: 'collapse',
          end_with_newline: true
        });

        this.results.beautifiedFiles[`beautified_${bundle.filename}`] = beautifiedJs;
        this.results.analysis.jsFiles++;

        // Extract React components
        this.extractReactComponents(beautifiedJs, bundle.filename);
        this.extractModules(beautifiedJs, bundle.filename);

      } catch (beautifyError) {
        console.warn(`Could not beautify ${bundle.filename}:`, beautifyError);
        this.results.beautifiedFiles[`raw_${bundle.filename}`] = jsContent;
      }
    } catch (error) {
      console.error(`Error processing ${bundle.url}:`, error);
    }
  }

  async downloadAndDecompileCSS(bundle: BundleInfo): Promise<void> {
    try {
      const response = await axios.get(bundle.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const cssContent = response.data;
      this.results.originalFiles[bundle.filename] = cssContent;

      // Basic CSS beautification (simple formatting)
      const beautifiedCss = this.beautifyCSS(cssContent);
      this.results.beautifiedFiles[`beautified_${bundle.filename}`] = beautifiedCss;
      this.results.analysis.cssFiles++;

    } catch (error) {
      console.error(`Error processing ${bundle.url}:`, error);
    }
  }

  beautifyCSS(css: string): string {
    // Simple CSS beautification
    return css
      .replace(/\{/g, ' {\n  ')
      .replace(/\}/g, '\n}\n')
      .replace(/;/g, ';\n  ')
      .replace(/,/g, ',\n  ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  extractReactComponents(jsContent: string, sourceFile: string): void {
    const patterns = [
      // Function components
      /function\s+([A-Z][a-zA-Z0-9]*)\s*\([^)]*\)\s*\{[^}]*return\s+[^}]*jsx?[^}]*\}/g,
      // Arrow function components
      /const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*\([^)]*\)\s*=>\s*\{[^}]*return[^}]*jsx?[^}]*\}/g,
      // Class components
      /class\s+([A-Z][a-zA-Z0-9]*)\s+extends\s+[^{]*\{[^}]*render\s*\(\s*\)\s*\{[^}]*return[^}]*\}/g,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null = pattern.exec(jsContent);
      while (match !== null) {
        if (match[1] && match[1][0] === match[1][0].toUpperCase()) {
          this.results.components.push({
            name: match[1],
            code: match[0],
            source: sourceFile
          });
        }
        match = pattern.exec(jsContent);
      }
    }

    this.results.analysis.components = this.results.components.length;
  }

  extractModules(jsContent: string, sourceFile: string): void {
    const modulePatterns = [
      /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
      /module\.exports\s*=\s*([^;]+)/g,
      /exports\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g,
      /import\s+(?:[^from]+from\s+)?["']([^"']+)["']/g,
      /require\(["']([^"']+)["']\)/g
    ];

    for (const pattern of modulePatterns) {
      let match: RegExpExecArray | null = pattern.exec(jsContent);
      while (match !== null) {
        if (match[1]) {
          this.results.modules.push({
            identifier: match[1],
            match: match[0],
            source: sourceFile
          });
        }
        match = pattern.exec(jsContent);
      }
    }

    this.results.analysis.modules = this.results.modules.length;
  }

  async trySourceMapRecovery(): Promise<void> {
    for (const bundle of this.results.bundles) {
      if (bundle.type === 'js') {
        try {
          const mapUrl = `${bundle.url}.map`;
          const response = await axios.get(mapUrl, { timeout: 10000 });

          if (response.status === 200) {
            const sourceMap = JSON.parse(response.data);
            await this.extractFromSourceMap(sourceMap, bundle.url);
          }
        } catch (error) {
          // Source map not available - this is expected for many sites
        }
      }
    }
  }

  async extractFromSourceMap(sourceMap: SourceMapInfo, originalUrl: string): Promise<void> {
    if (sourceMap.sources && sourceMap.sourcesContent) {
      for (let i = 0; i < sourceMap.sources.length; i++) {
        const sourcePath = sourceMap.sources[i];
        const content = sourceMap.sourcesContent[i];

        if (content && sourcePath) {
          const cleanPath = sourcePath
            .replace('webpack://', '')
            .replace('../', '')
            .replace('./', '');

          const filename = `source_${cleanPath.split('/').pop() || 'unknown.js'}`;
          this.results.originalFiles[filename] =
            `// Recovered from source map: ${originalUrl}\n// Original path: ${sourcePath}\n\n${content}`;
        }
      }
    }
  }

  async runFullDecompilation(): Promise<DecompilationResult> {
    try {
      // Step 1: Analyze HTML and find bundles
      const bundles = await this.analyzeHTML();

      if (bundles.length === 0) {
        throw new Error('No bundles found to decompile');
      }

      // Step 2: Try source map recovery
      await this.trySourceMapRecovery();

      // Step 3: Process all bundles
      for (const bundle of bundles) {
        if (bundle.type === 'js') {
          await this.downloadAndDecompileJS(bundle);
        } else if (bundle.type === 'css') {
          await this.downloadAndDecompileCSS(bundle);
        }
      }

      return this.results;
    } catch (error) {
      console.error('Decompilation failed:', error);
      throw error;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: DecompilationRequest = await request.json();

    if (!body.url || !body.jobId) {
      return NextResponse.json(
        { error: 'URL and jobId are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    // Create decompiler and run the process
    const decompiler = new WebDecompiler(body.url, body.jobId);
    const results = await decompiler.runFullDecompilation();

    // Save results to storage
    jobStorage.save(body.jobId, results);

    return NextResponse.json({
      success: true,
      jobId: body.jobId,
      results: {
        jsFiles: results.analysis.jsFiles,
        cssFiles: results.analysis.cssFiles,
        components: results.analysis.components,
        modules: results.analysis.modules,
        bundles: results.bundles.length,
        files: Object.keys(results.originalFiles).length + Object.keys(results.beautifiedFiles).length
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: 'Decompilation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
