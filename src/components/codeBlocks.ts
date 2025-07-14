// Tree-sitter-based block extraction for Python
import Parser from 'web-tree-sitter';
import pythonLang from 'tree-sitter-python';

let parser: any = null;
let python: any = null;

export async function extractPythonBlocks(code: string) {
  if (!parser || !python) {
    await Parser.init();
    parser = new Parser();
    python = await Parser.Language.load(pythonLang);
    parser.setLanguage(python);
  }
  const tree = parser.parse(code);
  const blocks: { start: number; end: number; code: string }[] = [];
  function addBlock(node: any) {
    const start = node.startPosition.row;
    const end = node.endPosition.row;
    const blockCode = code.split(/\r?\n/).slice(start, end + 1).join('\n');
    blocks.push({ start, end, code: blockCode });
  }
  tree.rootNode.children.forEach((node: any) => {
    if (['function_definition', 'class_definition'].includes(node.type)) {
      addBlock(node);
    }
  });
  // Add top-level code as a block if present
  let last = 0;
  tree.rootNode.children.forEach((node: any) => {
    if (['function_definition', 'class_definition'].includes(node.type)) {
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