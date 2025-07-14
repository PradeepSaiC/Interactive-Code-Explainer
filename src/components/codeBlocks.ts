export const codeBlocks = [
  {
    code: `// Block 1: Function signature and variable\ntypedef int i32;\ni32 add(i32 a, i32 b) {`,
    language: "c",
    explanation: {
      text: "This block defines a type alias for int and declares the add function.",
      mermaid: `graph TD; A[Start] --> B[Declare i32]; B --> C[Function add(a, b)]`,
    },
  },
  {
    code: `    // Block 2: Calculation\n    i32 result = a + b;`,
    language: "c",
    explanation: {
      text: "This block performs the addition and stores the result.",
      mermaid: `graph TD; C --> D[Calculate a + b]; D --> E[Store in result]`,
    },
  },
  {
    code: `    // Block 3: Return\n    return result;\n}`,
    language: "c",
    explanation: {
      text: "This block returns the result from the function.",
      mermaid: `graph TD; E --> F[Return result]; F --> G[End]`,
    },
  },
]; 