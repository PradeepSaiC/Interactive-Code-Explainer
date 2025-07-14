import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Parser from 'web-tree-sitter';
import pythonLang from 'tree-sitter-python';
import jsLang from 'tree-sitter-javascript';
import tsLang from 'tree-sitter-typescript/typescript';
import cLang from 'tree-sitter-c';
import cppLang from 'tree-sitter-cpp';
import javaLang from 'tree-sitter-java';

const LANG_GRAMMARS: Record<string, any> = {
  python: pythonLang,
  javascript: jsLang,
  typescript: tsLang,
  c: cLang,
  cpp: cppLang,
  java: javaLang,
};

let parser: any = null;
let loadedLanguages: Record<string, any> = {};

function getBlockNodeTypes(language: string): string[] {
  switch (language) {
    case 'python':
      return ['function_definition', 'class_definition'];
    case 'javascript':
    case 'typescript':
      return ['function_declaration', 'class_declaration', 'method_definition'];
    case 'c':
    case 'cpp':
      return ['function_definition'];
    case 'java':
      return ['method_declaration', 'class_declaration'];
    default:
      return [];
  }
}

function fallbackParagraphBlocks(code: string) {
  const paragraphs = code.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let idx = 0;
  return paragraphs.map((para) => {
    const lines = para.split(/\r?\n/);
    const start = idx;
    const end = idx + lines.length - 1;
    idx = end + 1;
    return { code: para, start, end };
  });
}

export async function POST(req: NextRequest) {
  try {
    const { code, language } = await req.json();
    if (!code || !language) {
      return NextResponse.json({ error: 'Missing code or language' }, { status: 400 });
    }
    if (!LANG_GRAMMARS[language]) {
      return NextResponse.json(fallbackParagraphBlocks(code));
    }
    if (!parser) {
      await Parser.init();
      parser = new Parser();
    }
    if (!loadedLanguages[language]) {
      loadedLanguages[language] = await Parser.Language.load(LANG_GRAMMARS[language]);
    }
    parser.setLanguage(loadedLanguages[language]);
    const tree = parser.parse(code);
    const blockTypes = getBlockNodeTypes(language);
    const blocks: { start: number; end: number; code: string }[] = [];
    function addBlock(node: any) {
      const start = node.startPosition.row;
      const end = node.endPosition.row;
      const blockCode = code.split(/\r?\n/).slice(start, end + 1).join('\n');
      blocks.push({ start, end, code: blockCode });
    }
    tree.rootNode.children.forEach((node: any) => {
      if (blockTypes.includes(node.type)) {
        addBlock(node);
      }
    });
    // Add top-level code as a block if present
    let last = 0;
    tree.rootNode.children.forEach((node: any) => {
      if (blockTypes.includes(node.type)) {
        if (node.startPosition.row > last) {
          blocks.push({
            start: last,
            end: node.startPosition.row - 1,
            code: code.split(/\r?\n/).slice(last, node.startPosition.row).join('\n'),
          });
        }
        last = node.endPosition.row + 1;
      }
    });
    if (last < code.split(/\r?\n/).length) {
      blocks.push({
        start: last,
        end: code.split(/\r?\n/).length - 1,
        code: code.split(/\r?\n/).slice(last).join('\n'),
      });
    }
    // Remove empty blocks
    return NextResponse.json(blocks.filter((b) => b.code.trim().length > 0));
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Block extraction error' }, { status: 500 });
  }
} 