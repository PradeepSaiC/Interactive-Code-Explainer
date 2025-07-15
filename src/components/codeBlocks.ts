// Add this at the very top of the file to suppress missing type declaration error
import 'tree-sitter-typescript/typescript';
// Tree-sitter-based block extraction for Python
import Parser from 'web-tree-sitter';
import pythonLang from 'tree-sitter-python';
import jsLang from 'tree-sitter-javascript';
import tsLang from 'tree-sitter-typescript/typescript';
import cLang from 'tree-sitter-c';
import cppLang from 'tree-sitter-cpp';
import javaLang from 'tree-sitter-java';
import goLang from 'tree-sitter-go';
import rustLang from 'tree-sitter-rust';
import phpLang from 'tree-sitter-php';
import rubyLang from 'tree-sitter-ruby';

const LANG_GRAMMARS: Record<string, any> = {
  python: pythonLang,
  javascript: jsLang,
  typescript: tsLang,
  c: cLang,
  cpp: cppLang,
  java: javaLang,
  go: goLang,
  rust: rustLang,
  php: phpLang,
  ruby: rubyLang,
};

// Use 'let' for parser and loadedLanguages if reassigned
let parser: any = null;
const loadedLanguages: Record<string, unknown> = {};

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
    case 'go':
      return ['function_declaration', 'method_declaration', 'type_declaration'];
    case 'rust':
      return ['function_item', 'struct_item', 'enum_item', 'impl_item'];
    case 'php':
      return ['function_definition', 'class_declaration', 'method_declaration'];
    case 'ruby':
      return ['method', 'class', 'module'];
    default:
      return [];
  }
}

export async function extractBlocks(code: string, language: string) {
  if (!LANG_GRAMMARS[language]) {
    // Fallback: paragraph splitter
    return fallbackParagraphBlocks(code);
  }
  const Parser = (await import('web-tree-sitter')).default;
  // @ts-expect-error: web-tree-sitter types do not include init()
  await Parser.init();
  // @ts-expect-error: web-tree-sitter types do not include constructor
  parser = new Parser();
  if (!loadedLanguages[language]) {
    loadedLanguages[language] = await Parser.Language.load(LANG_GRAMMARS[language]);
  }
  await parser.setLanguage(loadedLanguages[language]);
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
  return blocks.filter((b) => b.code.trim().length > 0);
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