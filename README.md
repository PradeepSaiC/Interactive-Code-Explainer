# Interactive Code Explainer - [Live Link](https://interactive-code-explainer.vercel.app/)

Interactive Code Explainer is a React-based web app that helps users understand code by breaking it into meaningful blocks and generating beginner-friendly explanations with AI. It combines a code editor, language selection, explanation panels, and highlighted code regions to make learning and debugging easier.

## Features


- Choose from multiple programming languages including JavaScript, Python, C, C++, and Java
- Write and edit code in a Monaco-powered editor
- Generate AI-powered explanations for code blocks
- Navigate through explanations block by block
- Highlight relevant lines in the editor for each explanation
- View generated output for the provided code

## Tech Stack

- React
- Parcel
- Monaco Editor
- Tailwind CSS
- Google Gemini AI
- Lucide Icons

## Project Structure

- src/components/Body.js - main app layout and explanation flow
- src/components/NavBar.js - top navigation bar
- src/components/Playground.js - editor, explanation generation, and output display
- src/index.js - app entry point
- src/index.css - global styling

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up your environment

Create a .env file in the project root and add your Gemini API key:

```env
GEMINI_API_KEY=your_api_key_here
```

### 3. Run the development server

```bash
npm run dev
```

The app will open in your browser using Parcel.

## Build for Production

```bash
npm run build
```

## Notes

- The app depends on the Gemini API for explanation generation.
- If the API key is missing or the service is unavailable, the app will show an error message instead of generating an explanation.
- The generated explanation is based on the current code content in the editor.

## License

This project is licensed under ISC.

